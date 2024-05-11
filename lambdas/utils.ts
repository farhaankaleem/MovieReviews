import {
    APIGatewayRequestAuthorizerEvent,
    APIGatewayAuthorizerEvent,
    PolicyDocument,
    APIGatewayProxyEvent,
  } from "aws-lambda";
  
  import axios from "axios"
  import jwt from 'jsonwebtoken'
  import jwkToPem from "jwk-to-pem";
  
  export type JwtToken = { sub: string; email: string } | null;
  export type Jwk = {
    keys: {
      alg: string;
      e: string;
      kid: string;
      kty: string;
      n: string;
      use: string;
    }[];
  };
  
  
  export const verifyToken = async (
    token: string,
    userPoolId: string | undefined,
    region: string
  ): Promise<JwtToken> => {
    try {
      const url = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
      const { data }: { data: Jwk } = await axios.get(url);
      const pem = jwkToPem(data.keys[0]);
  
      return jwt.verify(token, pem, { algorithms: ["RS256"] });
    } catch (err) {
      console.log(err);
      return null;
    }
  };
  
  export const createPolicy = (
    event: APIGatewayAuthorizerEvent,
    effect: string
  ): PolicyDocument => {
    return {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: effect,
          Action: "execute-api:Invoke",
          Resource: [event.methodArn],
        },
      ],
    };
  };
  