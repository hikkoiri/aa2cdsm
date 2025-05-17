import { DnsProvider } from "../enums";
import { ConfigInputParameters, DNSRecord, DNSRecordManager } from "../interfaces";
import { CloudflareDNSRecordManager } from "../repo/cloudflare";
import { SSM, SNS } from 'aws-sdk';

export class DNSProviderService {

    dnsRecordManager: DNSRecordManager;
    inputParameters: ConfigInputParameters;

    constructor(inputParameters: ConfigInputParameters) {
        this.inputParameters = inputParameters;
    }

    async init(): Promise<DNSProviderServiceImpl> {
        const apiKey = await this.getSSMParameter(this.inputParameters.apiKeyReference);

        switch (this.inputParameters.dnsProvider) {
            case DnsProvider.CLOUDFLARE:
                this.dnsRecordManager = new CloudflareDNSRecordManager(apiKey);
                return new DNSProviderServiceImpl(this);
            default:
                throw new Error(`Unsupported provider: ${this.inputParameters.dnsProvider}`);
        }
    }


    private async getSSMParameter(parameterName: string): Promise<string> {
        const ssm = new SSM();

        try {
            const result = await ssm.getParameter({
                Name: parameterName,
                WithDecryption: true
            }).promise();

            if (!result.Parameter || !result.Parameter.Value) {
                throw new Error(`Parameter ${parameterName} not found or has no value`);
            }

            return result.Parameter.Value;
        } catch (error: any) {
            throw new Error(`Failed to retrieve SSM parameter ${parameterName}: ${error.message}`);
        }
    }
}


export class DNSProviderServiceImpl implements DNSRecordManager {

    private dnsProviderService: DNSProviderService;
    private sns = new SNS();


    constructor(dnsProviderService: DNSProviderService) {
        this.dnsProviderService = dnsProviderService;
    }
    recordExists(recordName: string): Promise<string> {
        //never used
        throw new Error("Method not implemented.");
    }



    async addRecord(record: DNSRecord): Promise<void> {
        try {

            const foundRecord = await this.dnsProviderService.dnsRecordManager.recordExists(record.name);
            if (foundRecord !== '') {
                console.log(`Record ${record.name} already exists, nothing to do`);
                return;
            } else {
                await this.dnsProviderService.dnsRecordManager.addRecord(record);
                await this.sendNotification('success',
                    `Added DNS record: 
\`\`\`
Type: ${record.type}
Name: ${record.name}
Value: ${record.value}
\`\`\``);
            }
        } catch (error) {
            console.error(`Error adding DNS record: ${error}`);
            await this.sendNotification('error',
                `Failed to add DNS record:
\`\`\`
Type: ${record.type}
Name: ${record.name}
Value: ${record.value}
\`\`\`
Error:\n
\`\`\`                    
${JSON.stringify(error)}
\`\`\``,
            );
            throw error;
        }
    }
    async deleteRecord(recordName: string): Promise<void> {
        try {
            const foundRecord = await this.dnsProviderService.dnsRecordManager.recordExists(recordName);
            if (foundRecord === '') {
                console.log(`Record ${recordName} not found, nothing to delete`);
            }
            else {
                await this.dnsProviderService.dnsRecordManager.deleteRecord(recordName);
                await this.sendNotification('success',
                    `Deleted DNS record:
\`\`\`
Name: ${recordName}
\`\`\``,
                );
            }
        } catch (error) {
            console.error(`Error adding DNS record: ${error}`);
            await this.sendNotification('error',
                `Failed to delete DNS record:
\`\`\`
Name: ${recordName}
\`\`\`
Error:
\`\`\`                    
                ${JSON.stringify(error)}
                \`\`\``,
            );
            throw error;
        }
    }

    private async sendNotification(subject: string, message: string): Promise<void> {
        if (this.dnsProviderService.inputParameters.notificationTopic && this.dnsProviderService.inputParameters.notificationTopic.length > 0) {
            await this.sns.publish({
                TopicArn: this.dnsProviderService.inputParameters.notificationTopic,
                Subject: subject,
                Message: message,
            }).promise();
        }
    }
}


