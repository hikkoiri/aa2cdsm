#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Aa2CdsmStack } from '../lib/aa2cdsm-stack';
import { DnsProvider } from '../lambda/enums';



export interface Aa2CdsmStackProps extends cdk.StackProps {
  dnsProvider: DnsProvider;
  notificationSnsTopicArn?: string;
}


const app = new cdk.App();

const deploymentRegions = ['us-east-1', 'eu-central-1']
for (const region of deploymentRegions) {

  const prodProps: Aa2CdsmStackProps = {
    dnsProvider: DnsProvider.CLOUDFLARE,
    notificationSnsTopicArn: `arn:aws:sns:${region}:${process.env.CDK_DEFAULT_ACCOUNT}:sns-2-slack-notification-topic`
  };


  new Aa2CdsmStack(app, `aa2cdsm-stack-${region}`, {
    ...prodProps,
    env: {
      region,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
  });
}
