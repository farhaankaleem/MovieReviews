import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { CloudFrontWebDistribution } from 'aws-cdk-lib/aws-cloudfront';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { AuthApi } from './auth-api'
import {AppApi } from './app-api'
import * as path from 'path';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cognito from 'aws-cdk-lib/aws-cognito';

export class AuthAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, "UserPool", {
      signInAliases: { username: true, email: true },
      selfSignUpEnabled: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const userPoolId = userPool.userPoolId;
    const appClient = userPool.addClient("AppClient", {
      authFlows: { userPassword: true },
    });
    const userPoolClientId = appClient.userPoolClientId;
    const codeLayer = new lambda.LayerVersion(this, 'codeLayer', {
      code: lambda.Code.fromAsset(path.resolve(__dirname, __dirname+'/../../code-layer/')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
      description: "It has types-schema.json file, which is used by almost all the files for validation."
    });

    new AuthApi(this, 'AuthServiceApi', {
      userPoolId: userPoolId,
      userPoolClientId: userPoolClientId,
      codeLayer: codeLayer
    });
    new AppApi(this, 'AppApi', {
      userPoolId: userPoolId,
      userPoolClientId: userPoolClientId,
      codeLayer: codeLayer
    } );

    const siteBucket = new Bucket(this, "SiteBucket", {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      accessControl: BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      websiteIndexDocument: "index.html",
    });

    new BucketDeployment(this, "DeployWebsite", {
      sources: [Source.asset("./dist")],
      destinationBucket: siteBucket,
    });

    const oai = new cloudfront.OriginAccessIdentity(
      this,
      "OriginAccessIdentity"
    );
    siteBucket.grantRead(oai);

    const distribution = new CloudFrontWebDistribution(
      this,
      "ReactDeploymentDistribution",
      {
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: siteBucket,
              originAccessIdentity: oai,
            },
            behaviors: [{ isDefaultBehavior: true }],
          },
        ],
      }
    );

    new CfnOutput(this, "CloudFrontDistributionDomainName", {
      value: distribution.distributionDomainName,
      description: "CloudFront Distribution Domain Name",
    });
  }
}