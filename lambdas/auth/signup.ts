import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { SignUpBody } from "../../shared/types";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  SignUpCommandInput,
} from "@aws-sdk/client-cognito-identity-provider"; // ES Modules import
import Ajv from "ajv";

const fs = require('fs');
const schemaFilePath = '/opt/nodejs/types-schema.json';
const schemaData = fs.readFileSync(schemaFilePath, 'utf8');
const schema = JSON.parse(schemaData);
const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["SignUpBody"] || {});

const client = new CognitoIdentityProviderClient({ region:  process.env.REGION  });

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("[EVENT]", event);
    const body = event.body ? JSON.parse(event.body) : undefined;

    if (!isValidBodyParams(body)) {
      return {
        statusCode: 500,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: `Incorrect type. Must match SignUpBody schema`,
          schema: schema.definitions["SignUpBody"],
        }),
      };
    }

    const signUpBody = body as SignUpBody;

    const params: SignUpCommandInput = {
      ClientId: process.env.CLIENT_ID!,
      Username: signUpBody.username,
      Password: signUpBody.password,
      UserAttributes: [{ Name: "email", Value: signUpBody.email }],
    };

    const command = new SignUpCommand(params);
    const res = await client.send(command);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: res,
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: err,
      }),
    };
  }
};