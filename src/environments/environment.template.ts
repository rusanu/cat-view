// This is a template file - the actual environment.ts is auto-generated from .env
// Copy .env.example to .env and fill in your AWS credentials
// Run 'npm run config' to generate environment files from your .env
export const environment = {
  production: true,
  aws: {
    region: 'your-aws-region',
    bucketName: 'your-bucket-name',
    bucketFolder: 'your-folder-name',
    accessKeyId: 'your-access-key-id',
    secretAccessKey: 'your-secret-access-key',
  },
  google: {
    clientId: 'your-google-client-id',
  },
  cognito: {
    identityPoolId: 'your-identity-pool-id',
  }
};
