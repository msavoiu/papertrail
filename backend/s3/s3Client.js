import { S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({
    region: "us-west-2", // same as your bucket’s region
});

export default s3;
