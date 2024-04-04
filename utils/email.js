const nodemailer = require('nodemailer');

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Ayush Abad <${process.env.EMAIL_SENDER_ADDRESS}>`;
  }

  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      //  we will use sendgrid
      return 1;
    }
    return nodemailer.newTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async send(template, subject) {
    // create a template
    const html = template;
    // create options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      // text: htmlToText.fromString(html), it is package html-to-text
    };
    // send the mail
    await this.newTransport.sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('welcome', 'welcome to natours my nigga');
  }
};
