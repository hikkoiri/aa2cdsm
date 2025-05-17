export interface DNSRecord {
    type: string; // e.g., 'A', 'CNAME', 'TXT', etc.
    name: string;
    value: string;
}

export interface DNSRecordManager {
    addRecord(record: DNSRecord): Promise<void>;
    deleteRecord(recordName: string): Promise<void>;
    recordExists(recordName: string): Promise<string>;

}

export interface ConfigInputParameters {
    notificationTopic: string,
    dnsProvider: string
    apiKeyReference: string
}