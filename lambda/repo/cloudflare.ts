import { Zone } from "cloudflare/resources/zones/zones";
import { DNSRecord, DNSRecordManager } from "../interfaces";
import Cloudflare from 'cloudflare';


export class CloudflareDNSRecordManager implements DNSRecordManager {
    private client: Cloudflare;
    private zone: Zone;

    constructor(apiToken: string) {
        this.client = new Cloudflare({ apiToken });
    }

    async addRecord(record: DNSRecord): Promise<void> {
        console.log("Adding cloudflare record")
        const { id } = await this.getZone(record.name);

        const response = await this.client.dns.records.create({
            zone_id: id,
            name: record.name,
            type: record.type as "A" | "AAAA" | "CAA" | "CERT" | "CNAME" | "DNSKEY" | "DS" | "HTTPS" | "LOC" | "MX" | "NAPTR" | "NS" | "OPENPGPKEY" | "PTR" | "SMIMEA" | "SRV" | "SSHFP" | "SVCB" | "TLSA" | "TXT" | "URI",
            content: record.value,
            proxied: false,
            ttl: 3600,
        });

        console.log("Create DNS Record Cloudflare response: ", response);
    }

    async deleteRecord(recordName: string): Promise<void> {
        console.log("Deleting cloudflare record")
        const { id } = await this.getZone(recordName);
        const recordId = await this.recordExists(recordName);

        const response = await this.client.dns.records.delete(recordId, {
            zone_id: id,
        });

        console.log("Delete DNS Record Cloudflare response: ", response);
    }

    async recordExists(recordName: string): Promise<string> {
        console.log("Checking if cloudflare record exists")
        const { id, name } = await this.getZone(recordName);

        const sanitizedRecordName = recordName.endsWith('.') ? recordName.slice(0, -1) : recordName;
        const response = await this.client.dns.records.list({
            zone_id: id,
            name: {
                exact: sanitizedRecordName,
            }
        });

        console.log("List DNS Record Cloudflare response: ", response);
        return response.result.length > 0 ? response.result[0].id : '';
    }

    private async getZone(recordName: string): Promise<Zone> {
        if (this.zone) {
            return this.zone;
        } else {
            const zones = await this.client.zones.list({})
            zones.result.map((zone) => {
                if (recordName.includes(zone.name)) {
                    this.zone = zone;
                }
            })
            if (!this.zone) {
                throw new Error(`Zone ID not found for record name: ${recordName}`);
            }
            else {
                return this.zone;
            }
        }
    }
}