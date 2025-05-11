const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'KickConnect API',
      version: '1.0.0',
      description: 'API documentation for KickConnect',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local server',
      },
    ],
  },
  apis: ['./*.js', './routes/*.js'], // Adjust this to match your file structure
};

try {
  const swaggerDocs = swaggerJsDoc(swaggerOptions);
  module.exports = (app) => {
    app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
  };
} catch (error) {
  console.error('Error setting up Swagger:', error.message);
}
