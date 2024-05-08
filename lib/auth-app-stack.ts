import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { AuthApi } from './auth-api'
import {AppApi } from './app-api'
import * as path from 'path';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

export class AuthAppStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new UserPool(this, "UserPool", {
      signInAliases: { username: true, email: true },
      selfSignUpEnabled: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
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

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      websiteIndexDocument: "index.html"
    });

    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset("./dist")],
      destinationBucket: siteBucket
    });

    new cdk.CfnOutput(this, "WebsiteURL", {
      value: siteBucket.bucketWebsiteUrl
    })

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

  } 

}