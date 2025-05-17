import { ConfigInputParameters, DNSRecord } from "./interfaces";
import { DNSProviderService } from "./service/dns-provider";
import { ConfigService } from "aws-sdk";


export async function handler(event: any): Promise<void> {

  console.log("Event: ", JSON.stringify(event));
  const configService = new ConfigService();

  const ruleParameters: ConfigInputParameters = JSON.parse(event.ruleParameters);
  console.log("ruleParameters: ", JSON.stringify(ruleParameters));

  const invokingEvent = JSON.parse(event.invokingEvent);
  console.log("invokingEvent: ", JSON.stringify(invokingEvent));

  const configurationItemStatus = invokingEvent.configurationItem.configurationItemStatus;
  console.log("configurationItemStatus: ", configurationItemStatus);


  try {

    if (configurationItemStatus === 'ResourceDeleted') {

      if (!invokingEvent.configurationItemDiff) {
        console.log("Domain is deleted, no details regarding the ACM found, skipping this one");
        return;
      }
      else {
        //domain deleted, remove from dns provider
        console.log("Domain is deleted, removing from DNS provider");

        const dnsProviderService = await new DNSProviderService(ruleParameters).init();

        const domainValidationOptions = invokingEvent.configurationItemDiff.changedProperties.Configuration.previousValue.domainValidationOptions;
        for (const domainValidationOption of domainValidationOptions) {
          await dnsProviderService.deleteRecord(domainValidationOption.resourceRecord.name)
        }
      }
    }
    else {
      const domainValidationOptions = invokingEvent.configurationItem.configuration.domainValidationOptions;

      for (const domainValidationOption of domainValidationOptions) {

        const validationStatus = domainValidationOption.validationStatus;
        console.log("validationStatus: ", validationStatus);

        if (validationStatus === 'SUCCESS') {
          //domain validated, remove from dns provider
          console.log("Domain is already validated, nothing to do");
        }
        else {
          if (validationStatus === 'PENDING_VALIDATION' && configurationItemStatus === 'ResourceDiscovered') {
            //new domain, add to dns provider
            console.log("Domain is pending validation, adding to DNS provider");

            const dnsRecord: DNSRecord = {
              type: domainValidationOption.resourceRecord.type,
              name: domainValidationOption.resourceRecord.name,
              value: domainValidationOption.resourceRecord.value,
            };

            const dnsProviderService = await new DNSProviderService(ruleParameters).init();
            await dnsProviderService.addRecord(dnsRecord)
          }
        }
      }
    }


    const evaluationResult = {
      ComplianceResourceType: invokingEvent.configurationItem.resourceType,
      ComplianceResourceId: invokingEvent.configurationItem.resourceId,
      ComplianceType: 'COMPLIANT',
      Annotation: 'DNS records automatically set',
      OrderingTimestamp: new Date(invokingEvent.configurationItem.configurationItemCaptureTime),
    };

    JSON.stringify('Evaluation result:' + JSON.stringify(evaluationResult));

    await configService
      .putEvaluations({
        Evaluations: [
          evaluationResult
        ],
        ResultToken: event.resultToken,
      })
      .promise();

  } catch (error) {

    console.error(`Error: ${error}`);

    const evaluationResult = {
      ComplianceResourceType: invokingEvent.configurationItem.resourceType,
      ComplianceResourceId: invokingEvent.configurationItem.resourceId,
      ComplianceType: 'NON_COMPLIANT',
      Annotation: 'DNS records were not updated',
      OrderingTimestamp: new Date(invokingEvent.configurationItem.configurationItemCaptureTime),
    };

    JSON.stringify('Evaluation result:' + JSON.stringify(evaluationResult));

    await configService
      .putEvaluations({
        Evaluations: [
          evaluationResult
        ],
        ResultToken: event.resultToken,
      })
      .promise();
  }
}
