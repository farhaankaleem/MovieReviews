import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";

const fs = require("fs");
const schemaFilePath = "/opt/nodejs/types-schema.json";
const schemaData = fs.readFileSync(schemaFilePath, "utf8");
const schema = JSON.parse(schemaData);

const ajv = new Ajv();
const isValidQueryParams = ajv.compile(
  schema.definitions["MovieReviewQueryParams"] || {}
);

const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event:", event);
    const pathParams = event?.pathParameters;
    const queryParams = event?.queryStringParameters || {};

    if (!queryParams) {
      return buildErrorResponse(500, "Missing query parameters");
    }
    if (!isValidQueryParams(queryParams)) {
      return buildErrorResponse(
        500,
        "Incorrect type. Must match Query parameters schema",
        schema.definitions["MovieReviewQueryParams"]
      );
    }

    const movieId = pathParams?.movieId
      ? parseInt(pathParams.movieId)
      : undefined;
    const minRating = queryParams?.minRating
      ? parseInt(queryParams.minRating)
      : undefined;

    if (!movieId) {
      return buildErrorResponse(404, "Missing movie Id");
    }

    let commandInput: QueryCommandInput = {
      TableName: process.env.TABLE_NAME || "",
    };
    if ("minRating" in queryParams) {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "movieId = :m and rating > :r",
        ExpressionAttributeValues: {
          ":m": movieId,
          ":r": minRating,
        },
      };
    } else {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "movieId = :m",
        ExpressionAttributeValues: {
          ":m": movieId,
        },
      };
    }

    const commandOutput = await ddbDocClient.send(new QueryCommand(commandInput));

    if (!commandOutput.Items) {
      return buildErrorResponse(404, "Invalid movie Id");
    }

    return buildSuccessResponse(200, commandOutput.Items);
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return buildErrorResponse(500, "Internal server error");
  }
};

function createDocumentClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION || "" });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}

function buildSuccessResponse(statusCode: number, data: any) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      "Access-Control-Allow-Origin": "*",
      "content-type": "application/json",
    },
    body: JSON.stringify({ data }),
  };
}

function buildErrorResponse(statusCode: number, message: string, schema?: any) {
  const body = schema ? { message, schema } : { message };
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      "Access-Control-Allow-Origin": "*",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  };
}
