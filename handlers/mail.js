const nodemailer = require('nodemailer');
const pug = require('pug');
const juice = require('juice');  // CSS Inliner Tool
const htmlToText = require('html-to-text');  // convert HTML to text
const promisify = require('es6-promisify');

const transport = nodemailer.createTransport({
	host: process.env.MAIL_HOST,
	port: process.env.MAIL_PORT,
	auth: {
		user: process.env.MAIL_USER,
		pass: process.env.MAIL_PASS
	}
});

const generateHTML = (filename, options = {}) => {
	const html = pug.renderFile(`${__dirname}/../views/email/${filename}.pug`, options);  // password-reset.pug
	const inlined = juice(html);
	return inlined;
};

exports.send = async (options) => {
	const html = generateHTML(options.filename, options);
	const text = htmlToText.fromString(html);
	const mailOptions = {
		from: 'Carsten Rapp <carsten.rapp@icloud.com>',
		to: options.user.email,
		subject: options.subject,
		html,  // equals html: html
		text
	}
	const sendMail = promisify(transport.sendMail, transport);
	return sendMail(mailOptions);
};

/* for testing only, require mail.js in start.js to run it

transport.sendMail({
	from: 'Carsten Rapp <carsten.rapp@icloud.com>',
	to: 'randy@example.com',
	subject: 'Test Email',
	html: 'Testing <strong>things</strong> out.',
	text: 'Testing only'
});

*/
