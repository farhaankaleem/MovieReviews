import { APIGatewayRequestAuthorizerHandler } from "aws-lambda";
import { createPolicy, verifyToken } from "../utils";

export const handler: APIGatewayRequestAuthorizerHandler = async (event) => {
  console.log("[EVENT]", event);

  const authorizationHeader = event?.headers?.Authorization || event.headers?.authorization;

  if (!authorizationHeader) {
    return {
      principalId: "",
      policyDocument: createPolicy(event, "Deny"),
    };
  }

  const token = authorizationHeader.split(" ")[1];

  if (!token) {
    return {
      principalId: "",
      policyDocument: createPolicy(event, "Deny"),
    };
  }

  const verifiedJwt = await verifyToken(
    token,
    process.env.USER_POOL_ID,
    process.env.REGION!
  );

  return {
    principalId: verifiedJwt ? verifiedJwt.sub!.toString() : "",
    policyDocument: createPolicy(event, verifiedJwt ? "Allow" : "Deny"),
  };
};
