import nodemailer, { Transporter, TransportOptions } from 'nodemailer';
import ejs from 'ejs';
import path from 'path';

interface EmailOptions {
    email: string;
    subject: string;
    template: string;
    data: {
        [key: string]: any
    }
}

const sendEmail = async (options: EmailOptions): Promise<void> => {
    const transporter: Transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        service: process.env.SMTP_SERVICE,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        }
    } as TransportOptions);

    const { email, subject, template, data } = options;
    // Path to your email template
    const templatePath = path.join(__dirname, '../email', template);

    // Rendering email template with ejs
    const html: string = await ejs.renderFile(templatePath, data)

    const mailOptions = {
        from: process.env.SMTP_USER,
        to: email,
        subject: subject,
        html
    };
    await transporter.sendMail(mailOptions)

}
export default sendEmail

