import { Aws } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";

type AuthApiProps = {
  userPoolId: string;
  userPoolClientId: string;
  codeLayer: lambda.LayerVersion
};

export class AuthApi extends Construct {
  private auth: apig.IResource;
  private userPoolId: string;
  private userPoolClientId: string;
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: AuthApiProps) {
    super(scope, id);
    const { codeLayer } = props;
    this.userPoolId = props.userPoolId
    this.userPoolClientId = props.userPoolClientId

    const api = new apig.RestApi(this, "AuthServiceApi", {
      description: "Authentication Service RestApi",
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
      },
    });

    this.auth = api.root.addResource("auth");

    this.addAuthRoute(this.auth, "signup", "POST", "SignupFn", "signup.ts", this.userPoolId, this.userPoolClientId, codeLayer);

    this.addAuthRoute(
        this.auth,
      "confirm_signup",
      "POST",
      "ConfirmFn",
      "confirm-signup.ts", 
      this.userPoolId, 
      this.userPoolClientId,
      codeLayer
    );

    this.addAuthRoute(this.auth, "signout", "GET", "SignoutFn", "signout.ts", this.userPoolId, this.userPoolClientId, codeLayer);
    this.addAuthRoute(this.auth, "signin", "POST", "SigninFn", "signin.ts", this.userPoolId, this.userPoolClientId, codeLayer);

    this.apiUrl = api.url
    }

    private addAuthRoute(
        auth: apig.IResource,
        resourceName: string,
        method: string,
        fnName: string,
        fnEntry: string,
        userPoolId: string,
        userPoolClientId: string,
        codeLayer: lambda.LayerVersion
      ): void {
        const commonFnProps = {
          architecture: lambda.Architecture.ARM_64,
          timeout: cdk.Duration.seconds(10),
          memorySize: 128,
          runtime: lambda.Runtime.NODEJS_16_X,
          handler: "handler",
          layers: [codeLayer],
          environment: {
            USER_POOL_ID: userPoolId,
            CLIENT_ID: userPoolClientId,
            REGION: cdk.Aws.REGION,
          },
        };
    
        const resource = auth.addResource(resourceName);
    
        const fn = new node.NodejsFunction(this, fnName, {
          ...commonFnProps,
          entry: `${__dirname}/../../lambdas/auth/${fnEntry}`,
        });
    
        resource.addMethod(method, new apig.LambdaIntegration(fn));
      }
}