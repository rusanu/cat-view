// This is a template file - the actual environment.development.ts is auto-generated from .env
// Copy .env.example to .env and fill in your configuration
// Run 'npm run config' to generate environment files from your .env
export const environment = {
  production: false,
  aws: {
    region: 'your-aws-region',
    bucketName: 'your-bucket-name',
    bucketFolder: 'your-folder-name',
  },
  google: {
    clientId: 'your-google-client-id',
  },
  cognito: {
    identityPoolId: 'your-identity-pool-id',
  }
};
