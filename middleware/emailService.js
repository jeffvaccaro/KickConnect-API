require('dotenv').config();
const nodemailer = require('nodemailer'); // Import nodemailer
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const isProduction = process.env.NODE_ENV === 'production';

let sendEmail;

if (isProduction) {
  const sesClient = new SESClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  sendEmail = async (accountEmail, accountName, userId, accountId, accountCode) => {
    const emailParams = {
      Source: 'admin@kickConnect.com',
      Destination: {
        ToAddresses: [accountEmail],
      },
      Message: {
        Subject: {
          Data: 'Welcome to KickConnect!'
        },
        Body: {
          Text: {
            Data: `Hello ${accountName},\n\nWelcome to KickConnect!  Your account has been created. Please reset your password using the following link: http://${process.env.DOMAIN}/reset-password?accountId=${accountId}&userId=${userId}&accountCode=${accountCode}\n\nBest regards,\nkickConnect`
          }
        }
      }
    };

    try {
      const command = new SendEmailCommand(emailParams);
      const emailResponse = await sesClient.send(command);
      console.log('Email sent:', emailResponse.MessageId);
    } catch (error) {
      console.error('Error sending email:', error);
    }
  };
} else {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD
    }
  });

  sendEmail = async (accountEmail, accountName, userId, accountId, accountCode) => {
    const mailOptions = {
      from: process.env.SMTP_EMAIL,
      to: accountEmail,
      subject: 'Welcome to KickConnect!',
      text: `Hello ${accountName},\n\nWelcome to KickConnect!  Your account has been created. Please reset your password using the following link: http://${process.env.DOMAIN}/reset-password?accountId=${accountId}&userId=${userId}&accountCode=${accountCode}\n\nBest regards,\nkickConnect`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
      } else {
        console.log('Email sent:', info.response);
      }
    });
  };
}

module.exports = { sendEmail };
