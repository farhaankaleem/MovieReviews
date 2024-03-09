import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommandInput, QueryCommand } from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";
import { MovieReviews } from "../shared/types";

const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["MovieReviewEdit"] || {});


const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    // Print Event
    console.log("Event: ", event);
    const body: MovieReviews = event.body ? JSON.parse(event.body) : undefined;

    if (!body) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing request body" }),
      };
    }

    if (!isValidBodyParams(body)) {
        return {
          statusCode: 400,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            message: `Incorrect type. Must match Movie schema`,
            schema: schema.definitions["Movie"],
          }),
        };
    }

    const pathParams = event?.pathParameters;
    const movieId = pathParams?.movieId ? parseInt(pathParams.movieId) : undefined;
    const reviewerName = pathParams?.reviewerName ? pathParams.reviewerName : undefined;


    if (!movieId) {
        return {
          statusCode: 404,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ Message: "Missing movie Id" }),
        };
    }

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
        IndexName: "reviewerIx",
        KeyConditionExpression: "movieId = :m and begins_with(reviewerName, :r)",
        ExpressionAttributeValues: {
          ":m": movieId,
          ":r": reviewerName,
        },
      };

    const commandOutput = await ddbDocClient.send(
        new QueryCommand(commandInput)
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

        const movieReviewToUpdate = commandOutput.Items[0];
        movieReviewToUpdate.content = body.content;

    await ddbDocClient.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: movieReviewToUpdate,
      })
    );
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: "Movie Review edited" }),
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

function createDDbDocClient() {
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
