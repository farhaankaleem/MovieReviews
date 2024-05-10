import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as cdk from "aws-cdk-lib";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { generateBatch } from "../../shared/util";
import { movieReviews} from "../../seed/movieReviews";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as path from 'path';

type AppApiProps = {
  userPoolId: string;
  userPoolClientId: string;
  codeLayer: lambda.LayerVersion
};


export class APIApp extends Construct {
    public readonly apiUrl: string;
  
    constructor(scope: Construct, id: string, props: AppApiProps) {
      super(scope, id);

      // Tables 
    const movieReviewsTable = new dynamodb.Table(this, "MovieReviewsTable", {
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
        sortKey: { name: "rating", type: dynamodb.AttributeType.NUMBER },
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        tableName: "MovieReviews",
      });
  
      movieReviewsTable.addLocalSecondaryIndex({
        indexName: "reviewerIx",
        sortKey: { name: "reviewerName", type: dynamodb.AttributeType.STRING },
      });
  
      movieReviewsTable.addLocalSecondaryIndex({
        indexName: "dateIx",
        sortKey: { name: "reviewDate", type: dynamodb.AttributeType.STRING },
      });

    const appApi = new apig.RestApi(this, "AppApi", {
      description: "App RestApi",
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
        allowMethods: apig.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    const nodeLayer = new lambda.LayerVersion(this, 'nodeLayer', {
      code: lambda.Code.fromAsset(path.resolve(__dirname, __dirname+'/../../../node-layer/')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
      description: "It has the library @aws-sdk/client-dynamodb, which is used by almost all the APIs."
    });

    const appCommonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      layers: [props.codeLayer, nodeLayer],
      environment: {
        USER_POOL_ID: props.userPoolId,
        CLIENT_ID: props.userPoolClientId,
        REGION: cdk.Aws.REGION,
        TABLE_NAME: movieReviewsTable.tableName
      },
    };

    const authorizerFn = new node.NodejsFunction(this, "AuthorizerFn", {
      ...appCommonFnProps,
      entry: "./lambdas/auth/authorizer.ts",
    });

    const requestAuthorizer = new apig.RequestAuthorizer(
      this,
      "RequestAuthorizer",
      {
        identitySources: [apig.IdentitySource.header("cookie")],
        handler: authorizerFn,
        resultsCacheTtl: cdk.Duration.minutes(0),
      }
    );
  
      // Functions 
      const getMovieReviewFn = new lambdanode.NodejsFunction(
        this,
        "GetMovieReviewFn",
        {
            ...appCommonFnProps,
            entry: `${__dirname}/../../lambdas/getMovieReview.ts`
        }
      );
  
      const addMovieReviewFn = new lambdanode.NodejsFunction(
        this,
        "AddMovieReviewFn",
        {
            ...appCommonFnProps,
            entry: `${__dirname}/../../lambdas/addMovieReview.ts`,
        }
      );
  
      const getMovieReviewerFn = new lambdanode.NodejsFunction(
        this,
        "GetMovieReviewerFn",
        {
            ...appCommonFnProps,
            entry: `${__dirname}/../../lambdas/getReviewbyReviewerName.ts`
        }
      );
  
      const editMovieReviewFn = new lambdanode.NodejsFunction(
        this,
        "EditMovieReviewFn",
        {
            ...appCommonFnProps,
            entry: `${__dirname}/../../lambdas/putMovieReviewFn.ts`
        }
      );
  
      const getReviewbyReviewerNameFn = new lambdanode.NodejsFunction(
        this,
        "GetReviewbyReviewerNameFn",
        {
            ...appCommonFnProps,
            entry: `${__dirname}/../../lambdas/getReviewFn.ts`
        }
      );
  
      const getTranslatedReviewFn = new lambdanode.NodejsFunction(
        this,
        "GetTranslatedReviewFn",
        {
            ...appCommonFnProps,
            entry: `${__dirname}/../../lambdas/getTranslateReviewFn.ts`
        }
      );
  
      //Initialization
          new custom.AwsCustomResource(this, "movieReviewsddbInitData", {
            onCreate: {
              service: "DynamoDB",
              action: "batchWriteItem",
              parameters: {
                RequestItems: {
                  [movieReviewsTable.tableName]: generateBatch(movieReviews)
                },
              },
              physicalResourceId: custom.PhysicalResourceId.of("movieReviewsddbInitData")
            },
            policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
              resources: [movieReviewsTable.tableArn]
            })
          });
          
  
          // Permissions 
          movieReviewsTable.grantReadData(getMovieReviewFn)
          movieReviewsTable.grantReadWriteData(addMovieReviewFn)
          movieReviewsTable.grantReadData(getMovieReviewerFn)
          movieReviewsTable.grantReadWriteData(editMovieReviewFn)
          movieReviewsTable.grantReadData(getReviewbyReviewerNameFn)
          movieReviewsTable.grantReadData(getTranslatedReviewFn)
          
  
          const moviesEndpoint = appApi.root.addResource("movies");
          const reviewRootEndpoint = appApi.root.addResource("reviews");
          const reviewerRootEndPoint = reviewRootEndpoint.addResource("{reviewerName}");
          const movieReviewEndpoint = moviesEndpoint.addResource("{movieId}").addResource("reviews");
          const reviewsEndpoint = moviesEndpoint.addResource("reviews");
          const reviewerEndPoint = movieReviewEndpoint.addResource("{reviewerName}")
          const translateEndPoint = reviewerRootEndPoint.addResource("{movieId}").addResource("translation");
          
          movieReviewEndpoint.addMethod(
              "GET",
              new apig.LambdaIntegration(getMovieReviewFn, { proxy: true })
          );
  
          reviewsEndpoint.addMethod(
            "POST",
            new apig.LambdaIntegration(addMovieReviewFn, { proxy: true }), {
                authorizer: requestAuthorizer,
                authorizationType: apig.AuthorizationType.CUSTOM,
              }
          );
          
          reviewerEndPoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getMovieReviewerFn, { proxy: true })
          );
  
          reviewerEndPoint.addMethod(
            "PUT",
            new apig.LambdaIntegration(editMovieReviewFn, { proxy: true }), {
                authorizer: requestAuthorizer,
                authorizationType: apig.AuthorizationType.CUSTOM,
              }
          );
  
          reviewerRootEndPoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getReviewbyReviewerNameFn, { proxy: true })
          );
  
          translateEndPoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getTranslatedReviewFn, { proxy: true })
          );

          this.apiUrl = appApi.url
    }
}