import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv();
const isValidQueryParams = ajv.compile(
  schema.definitions["MovieReviewQueryParams"] || {}
);

 
const ddbDocClient = createDocumentClient();
const translateClient = new TranslateClient({ region: "us-east-1" });

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event:", event);
    const pathParams = event?.pathParameters;
    
    const movieId = pathParams?.movieId ? parseInt(pathParams.movieId) : undefined;
    const reviewerName = pathParams?.reviewerName ? pathParams.reviewerName : undefined;
    const queryParams = event?.queryStringParameters || {};
    
    if (!queryParams) {
      return {
        statusCode: 500,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing query parameters" }),
      };
    }
    if (!isValidQueryParams(queryParams)) {
      return {
        statusCode: 500,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: `Incorrect type. Must match Query parameters schema`,
          schema: schema.definitions["MovieReviewQueryParams"],
        }),
      };
    }

    const language = queryParams?.language ? queryParams.language : undefined;

    const validTargetLanguageCodes = ["af", "sq", "am", "ar", "hy", "az", "bn", 
    "bs", "bg", "ca", "zh", "zh-TW", "hr", "cs", "da", "fa-AF", "nl", "en", "et", 
    "fa", "tl", "fi", "fr", "fr-CA", "ka", "de", "el", "gu", "ht", "ha", "he", 
    "hi", "hu", "is", "id", "ga", "it", "ja", "kn", "kk", "ko", "lv", "lt", "mk", 
    "ms", "ml", "mt", "mr", "mn", "no", "ps", "pl", "pt", "pt-PT", "pa", "ro", "ru",
     "sr", "si", "sk", "sl", "so", "es", "es-MX", "sw", "sv", "ta", "te", "th", "tr", 
     "uk", "ur", "uz", "vi", "cy"];

    if (!language) {
        return {
          statusCode: 404,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ Message: "Missing language" }),
        };
    }

    if (!validTargetLanguageCodes.includes(language)) {
        return {
            statusCode: 400,
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ Message: "Unsupported Language" }),
          };
      }

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

      const review = commandOutput.Items[0].content;

      const translateParams = {
        Text: review,
        SourceLanguageCode: "en",
        TargetLanguageCode: language,  
      };
      
      const translationResult = await translateClient.send(new TranslateTextCommand(translateParams));
      const translatedReview = translationResult.TranslatedText;

      return {
        statusCode: 200,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          data: translatedReview,
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

