import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommandInput,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

 
const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event:", event);
    const pathParams = event?.pathParameters;
    
    const reviewerName = pathParams?.reviewerName ? pathParams.reviewerName : undefined;

    if (!reviewerName) {
        return {
          statusCode: 404,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ Message: "Missing Reviewer Name" }),
        };
    }

    let commandInput: QueryCommandInput = {
      TableName: process.env.TABLE_NAME,
    };

    
        commandInput = {
            ...commandInput,
            FilterExpression: "begins_with(reviewerName, :r)",
            ExpressionAttributeValues: {
                ":r": reviewerName
            },
          };


    const commandOutput = await ddbDocClient.send(
      new ScanCommand(commandInput)
      );

      if (!commandOutput.Items) {
        return {
          statusCode: 404,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ Message: "Invalid movie Id" }),
        };
      }

      return {
        statusCode: 200,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          data: commandOutput.Items,
        }),
      };
    } catch (error: any) {
      console.log(JSON.stringify(error));
      return {
        statusCode: 500,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ error }),
      };
    }
  };
  
  function createDocumentClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
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
