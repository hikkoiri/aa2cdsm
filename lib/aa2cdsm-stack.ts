import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Aa2CdsmStackProps } from '../bin/aa2cdsm';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import path = require('path');
import { CustomRule, EvaluationMode, ResourceType } from 'aws-cdk-lib/aws-config';
import { ConfigInputParameters } from '../lambda/interfaces';

export class Aa2CdsmStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Aa2CdsmStackProps) {
    super(scope, id, props);

    const acmLambda = new NodejsFunction(this, 'aa2cdsm-acm-lambda', {
      functionName: 'aa2cdsm-acm-lambda',
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, `/../lambda/acm.ts`),
      memorySize: 256,
    });

    const inputParameters: ConfigInputParameters =
    {
      notificationTopic: props.notificationSnsTopicArn || '',
      dnsProvider: props.dnsProvider,
      apiKeyReference: `/aa2cdsm/${props.dnsProvider}/api-key`,
    }

    new CustomRule(this, 'aa2cdsm-acm-config-rule', {
      configRuleName: 'aa2cdsm-acm-config-rule',
      lambdaFunction: acmLambda,
      evaluationModes: EvaluationMode.DETECTIVE,
      configurationChanges: true,
      ruleScope: {
        resourceTypes: [ResourceType.ACM_CERTIFICATE],
      },
      inputParameters
    });


    if (props.notificationSnsTopicArn) {
      const snsTopic = Topic.fromTopicArn(this, 'sns-topic', props.notificationSnsTopicArn);
      snsTopic.grantPublish(acmLambda);
    }

    acmLambda.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
      `arn:aws:ssm:${this.region}:${this.account}:parameter/aa2cdsm/${props.dnsProvider}/api-key`
      ]
    }));

    acmLambda.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['config:PutEvaluations'],
      resources: ['*']
    }));
  }
}
