import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { InfraStack } from "../lib/stacks/fullstack-app-stack";
import { CertStack} from '../lib/stacks/acm-cert-stack'
const app = new cdk.App();
import { Account, Region} from '../env'

const certStack = new CertStack(app, "CertStack", {
  env: {
    region: "us-east-1",
    account: Account,
  },
  crossRegionReferences: true,
});

new InfraStack(app, "FullStack", {
  env: {
    region: Region,
    account: Account,
  },
  crossRegionReferences: true,
//   certificate: certStack.certificate,
//   zone: certStack.zone
});
