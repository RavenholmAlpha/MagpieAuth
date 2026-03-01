import { authenticator } from 'otplib';
const secret = "YBWH4PHSFLBIZWL2F7TKS475PGYTZRP6";
console.log("OTPLib Code: " + authenticator.generate(secret));
