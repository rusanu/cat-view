export const environment = {
  production: false,
  aws: {
    region: process.env['AWS_REGION'] || '',
    bucketName: process.env['AWS_BUCKET_NAME'] || '',
    bucketFolder: process.env['AWS_BUCKET_FOLDER'] || '',
    accessKeyId: process.env['AWS_ACCESS_KEY_ID'] || '',
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] || '',
  }
};
