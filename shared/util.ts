import { marshall } from "@aws-sdk/util-dynamodb";
import { MovieReviews } from "./types";

type Entity = MovieReviews;  // NEW

export const generateMovieItem = (entity: Entity) => {
  return {
    PutRequest: {
      Item: marshall(entity),
    },
  };
};

export const generateBatch = (data: Entity[]) => {
  return data.map((e) => {
    return generateMovieItem(e);
  });
};
