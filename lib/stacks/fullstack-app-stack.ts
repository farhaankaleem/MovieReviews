import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import { APIApp } from "../constructs/api-app";
import { FrontendApp } from "../constructs/frontend";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { AuthApi } from '../constructs/auth-api';
import * as lambda from "aws-cdk-lib/aws-lambda";
import { BlockPublicAccess, Bucket, BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import { CloudFrontWebDistribution } from 'aws-cdk-lib/aws-cloudfront';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as path from 'path';
import * as cognito from 'aws-cdk-lib/aws-cognito';

type InfraStackProps = StackProps & {
  certificate?: acm.Certificate;
  zone: route53.IHostedZone;
};

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, props);


      const codeLayer = new lambda.LayerVersion(this, 'codeLayer', {
        code: lambda.Code.fromAsset(path.resolve(__dirname, __dirname+'/../../../code-layer/')),
        compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
        description: "It has types-schema.json file, which is used by almost all the files for validation."
      });



    const userPool = new UserPool(this, "UserPool", {
      signInAliases: { username: true, email: true },
      selfSignUpEnabled: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const userPoolId = userPool.userPoolId;

    const appClient = userPool.addClient("AppClient", {
      authFlows: { userPassword: true },
    });

    const userPoolClientId = appClient.userPoolClientId;

    const authAPI = new AuthApi(this, 'AuthServiceApi', {
			userPoolId: userPoolId,
			userPoolClientId: userPoolClientId,
            codeLayer: codeLayer
		});

    const apiApp = new APIApp(this, "APIApp", {
        userPoolId: userPoolId,
        userPoolClientId: userPoolClientId,
        codeLayer: codeLayer
    });

    new FrontendApp(this, "FrontendApp", {
      apiUrl: apiApp.apiUrl,
      authUrl: authAPI.apiUrl,
      certificate: props.certificate,
      zone: props.zone,
    });

  }
}
