//const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const path = require('path');//navigates path to files
const {validate} = require('deep-email-validator');//ensures the email address is in the correct format
const bcrypt = require('bcryptjs');//to hash the password
const nodemailer = require('nodemailer')// to enable the email service
const session = require('express-session');//to store variables in sessions so that they can be retrieved for reuse
const crypto = require('crypto')



const app = express();
const port = 3001;


//middleware
app.use(bodyParser.urlencoded({extended: true})); // for url encoded submissions
//app.use(express.urlencoded({ extended: true }));
app.use(express.json());//for JSON payloads

// Configure session middleware
app.use(session({
  secret: 'uvytc6c67cu7ct6xc56xc7',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 *60 * 1000}//i minute expiration
}));


app.use(express.static(path.join(__dirname, 'public')))//serve the static file


//connect ot the database
const connection = mysql.createConnection({
  host : 'localhost',
  user : 'root',
  password : 'Fejq.36@',
  database : 'Pway',
});

//check the connection
connection.connect(function (error) {
  if(error){
  console.log('Error connecting to the database ', error);
return;
  }
  console.log('Connection to the database succesfull')
});

//implementation of deep email validator
async function isEmailValid(email) {
  return validate({
    email: email,
    validateRegex: true,
    validateMx: true,
    validateTypo: true,
    validateDisposable: true,
    validateSMTP: false,
  });
}

//serve the signup html file
app.get('/', (req, res) =>{
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
})

//generate a 64-character hexadecimal string to be used in email verification
  const generateToken = () =>{
   const token = crypto.randomBytes(32).toString('hex')
   console.log('Generated token: ', token)
    return token;
  }

//handle the form submission
app.post('/signup', async(req, res) => {
  const {Firstname, Lastname, Email_address, User_password, Country, Phone_number} = req.body;

  //check if name is entered
  if(!Firstname){
    console.log('Names not entered')
    return res.status(400).json({errorMsg:'Please populate firstname fields'})
  }

  if(typeof Firstname !== 'string' || typeof Lastname !== 'string'){
    console.log('Name data type is not string')
    return res.status(400).json({errorMsg:'Your name may not be in the valid data type.'})
  }
  if(!Country){
    console.log('No country input')
    res.status(400).json({errorMsg:'Please populate country field'})
    return;
  }
  //check if the email is a string
  if(typeof Email_address !== 'string' || !Email_address.trim()){
    res.status(400).json({errorMsg:'Invalid email format. Please provide a valid email address.'});
    return;
  }

  //email to be validated in the console
  console.log('Email to validate: ', Email_address)

  //validation flags
  var invalid = false;
  var errMessage = [];
  
  //Email validation using regular expression
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  try {
    if (!emailRegex.test(Email_address)) {
      invalid = true;
      res.status(400).json({errorMsg:`Invalid email format, try again OR consider using gmail accounts if you aren't.`});
      return;
    }
  } catch (err) {
    console.error('Error validating email:', err);
    res.status(500).send('Error validating email address.');
    return;
  }


  if (User_password === '12345678' || User_password === '00000000') {
    invalid = true;
    errMessage.push('Please use a stronger combinational password.');
  }
   if (User_password.length < 8) {
    invalid = true;
    errMessage.push('Password must be at least eight characters long.');
  }
  
  
  //if there are errors
  if(invalid){
    console.error('Validation errors: ', errMessage)
    res.status(400).json(errMessage.join('<br>'));
    return;
  }

  //Check existence of user
  try {
    const [results] = await connection.promise().query("SELECT * FROM Users WHERE Email_address = ?", [Email_address])
    
    if(results.length > 0){
      console.log('Existing records: ', results)
      console.error(`Email already exists ${results[0].Email_address}`)
      res.status(400).json({errorMsg:'Email already in use. Please use another email address.'})
      return;
    }
  } catch (selecterr) {
    console.log('database query erro: ', selecterr)
    return res.status(400).json({errorMsg:'Error checking user existence.'})
  }
  
//initialize the saltrounds
  const saltRounds = 10;
  
    //carry out database insertion
    try {
      
      //use the bcrypt to hash the password
      const hashedPassword = await bcrypt.hash(User_password, saltRounds)
      const [insertResult] = await connection.promise().query
      ("INSERT INTO Users(Firstname, Lastname, Email_address, User_password, Country, Phone_number) VALUES (?, ?, ?, ?, ?, ?)",
       [Firstname, Lastname, Email_address, hashedPassword, Country, Phone_number]);
        
      
      if(insertResult.affectedRows < 0){
        console.log('Data insertion error: ', inserterror);        
      
        res.status(500).json({errorMsg:'Error storing user data.'});
        return;
      }

      if(insertResult.affectedRows > 0) {

        const [selectRecords] = await connection.promise().query
        ("SELECT * FROM Users WHERE Email_address = ?", [Email_address]);

        if(selectRecords.affectedRows === 0){
          console.log('User not found')
          return res.status(500).json({errorMsg:'No user data found to send email'})
        }

        
        //Create username and store it in the database
        const namedUser = selectRecords[0].Firstname;
        const email = selectRecords[0].Email_address;
        const username = email.split('@')[0];
            //generate a short code for username end code
          function generateShortCode() {        
            const combinators = "0a1pb2cd3e4fgh5ijk6lm7no8pqrs9tuvxyz";
            var CodeLength = 4;
            var usernameCode = "";
            for (let i = 0; i < CodeLength; i++){
              usernameCode += combinators.charAt(Math.floor(Math.random() * combinators.length));
            }
                  // return result;
            return usernameCode;
            }
            const shortCode = generateShortCode();
            const secureUsername = username.concat(shortCode)

            //output the generated username on the console
            console.log('Your generated username: ', secureUsername);

            //replace the default value of username with the generated username
            const [updateUsernameResult] = await connection.promise().query
            ("UPDATE Users SET Username = ? WHERE Email_address = ?", [secureUsername, Email_address]);
            if(updateUsernameResult.affectedRows > 0){
              console.log('Username created and stored successfully')
            }else{
              return res.status(500).json({errorMsg:'Sorry, we are unable to store your username.'})

            }

            //check if the generated username has been stored in the databse
            const [checkUsernameResult] = await connection.promise().query("SELECT * FROM Users WHERE Email_address = ?", [Email_address]);
            if(checkUsernameResult.affectedRows < 0){
              console.log('Problem generating or storing your username');
            }
            const realUsername = checkUsernameResult[0].Username;

            //save the token in the db
        const token = generateToken();
        const [updToken] = await connection.promise().query('UPDATE Users SET Token = ? WHERE Email_address = ?', [token, Email_address])

        if (updToken.affectedRows > 0) {
          console.log('Token saved succesfully.')
          console.log('Results: ', updToken)
        }else{
          console.log('Failed to store token in the db.')
        }

        const verificationLink = `http://localhost:3001/verify.html?code=${token}`;
        console.log('Verification link is: ', verificationLink)
        const transporter = nodemailer.createTransport({
          host:'smtp.gmail.com', //use your smtp host
          port: 465, //ssl port for secure email
          secure: true, //use ssl
          auth: {
            user: 'pm204626@gmail.com', //your email
            pass: 'fsjz hxbo sfbg npcy',// app-specific password
          }
          
        });

        const emailBody = `
              <html>
              <head>
              
              </head>
              <body>

              <h5>Hi, ${realUsername}</h5>
              <p>Thank you for being a member at P-Way Express.</p>
              <p>Your registration details are as follows:

                <ul>
                <li>Username: ${realUsername}</li>
                <li>Email: ${email}
                </ul></p>
                <p>
                Follow this link to Verify email: ${verificationLink}.</a>

                </p>
              <p>If you did not signup, you can ignore this email.</p>




              </body>
              </html>
        
        `;

        transporter.verify((error, success) => {
          if (error) {
            console.error("Error verifying transporter: ", error);
          } else {
            console.log("Transporter is ready to send messages");
          }
        });
        //Place the options
        const mailoptions = ({
          from: 'pm204626@gmail.com',//sender email address
          to: Email_address, //receiver email address
          subject: 'Karibu P`Way-Email Verification', //email subject
          html: emailBody,
        })
  
      //send the email and get a callback error or message with the sent email details
      transporter.sendMail(mailoptions, (sendErr, sendMsg) =>{
        if(sendErr){
          console.log('Error sending the email: ', sendErr)
          res.status(500).json({errorMsg: 'Failed to send email.'})
          return;
        }
        console.log('Email sent: ' ,sendMsg)
        
        res.on('finish', () => {
          console.log('Registration response sent to client.');
        });
      })

      res.status(200).json({ signupMsg: 'Registration successful. Verify this email from your email inbox.' });

        return;
      }

    } catch (inserterr) {
      console.log('Database insertion or password hashing error: ', inserterr)
      return res.status(400).json({errorMsg:'Error processing your request'})
    }

    
      
    });


    //*2* Email verification route

app.get('http://localhost:3001/verify.html?code=:token', async(req, res)=>{
  const {token} = req.params

  if (!token) {
    return res.status(400).send("Token is missing.");
  }

  try {
   const [verifyResults] = await connection.promise().query("SELECT * FROM Users WHERE Token = ?", [token])
   if (verifyResults.length === 0) {
    console.log('Invalid token')
    return res.status(500).json({errorMsg:'Invalid or expired token.'})
   }

   const email = verifyResults[0].Email_address
   const updateRes = await connection.promise().query
   ("UPDATE Users SET Verified = 'Yes', Token = NULL WHERE Email_address = ?", [email])

   if (updateRes.affectedRows > 0) {
    console.log('Email now verified')
    res.status(200).json({verifySuccMsg:'Email verified successfully.'})

    //redirect to next page
    res.redirect('http://localhost:3001/login.html', 4000)
    return;

   }
  } catch (error) {
    console.log('Database error: ', error)
    return res.status(500).json({errorMsg:'Internal server. Try again later!'})
  }
    
  
})



//*2* Login the user
//serve the login html file
app.get('/login', (req, res) =>{
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
})
app.post('/login', async(req, res) => {
  const {Email_address, User_password} = req.body;

  req.session.email = Email_address;//store the email in session
  console.log('Session set: ', req.session)

  console.log("Received email/username for login:", Email_address); // Debug log

  if(!Email_address || !User_password){
    console.log('Input email/username or password')
    return res.status(400).json({errorMsg:'Email/username and password required'})
  }
  
  //check if input is an email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmail = emailRegex.test(Email_address);


    try {

      //query for user by email or username
      const query = isEmail
      ? "SELECT * FROM Users WHERE Email_address = ?"
      : "SELECT * FROM Users WHERE Username = ?";
      
      const [loginResult] = await connection.promise().query(query, [Email_address]);
      if (loginResult.length === 0) {

        res.status(400).json({errorMsg:"User not found. You have to create an account first."})
        return;
      } 

      const userCredentials = loginResult[0];
      const storedHashedPassword = userCredentials.User_password;

      const isPassCorrect = await bcrypt.compare(User_password, storedHashedPassword)

      if(!isPassCorrect){
        console.log('Error comparing passwords')
        return res.status(500).json({errorMsg:'Your password or email/username is incorrect'})
      }

      //successful login
      console.log(`User logged in ${isEmail ? "Email": "Username"}, ${Email_address}`)
       res.status(200).json({loginMsg:'Hello. Welcome back!'})
       return;
    } catch (error) {
      console.log('Database error', error)
      return res.status(500).send('An error has occured. Try again later')
    }

  /*bcrypt.compare(User_password, storedHashedPassword, (compareError, isMatch) =>{
    if(compareError){
      console.log('Error comparing passwords: ', compareError)
      res.status(400).json({errorMsg:'Error logging you in.'}) malowapaul20046ef0
      return;
    }
    
    if (isMatch){
      return res.status(200).json({loginMsg:'Login Successfull. Welcome back.'})
      //res.redirect('/index')
    }else{
      return res.status(400).json({errorMsg:'Wrong password or email, please try again.'})
    }

  })*/
  
})

//Generate the verification code
    //this code will be used publicly
    function generateCode() {        
      const combinators = "0123456789";
      var CodeLength = 6;
      var codeGenerated = "";
      for (let i = 0; i < CodeLength; i++){
        codeGenerated += combinators.charAt(Math.floor(Math.random() * combinators.length));
      }
            // return result;
      return codeGenerated;
      }
      
      
//Serve the request password reset
app.get('/request_reset', (req,res) =>{
  res.sendFile(path.join(__dirname, 'public', 'request_reset.html'))
})
app.post('/request_reset', async(req,res) =>{
  const {Email_address} = req.body;
  
  console.log('Session before storing email: ', req.session)
  req.session.email = req.body.Email_address;//store the email address in session
  console.log('Email stored in session: ', req.session.email)
  console.log('Email received: ', Email_address)
  

  //check email exists
  if (!Email_address) {
    console.error('Email is undefined in the request body')
    res.status(400).json({errorMsg: 'Email address/Username required.'})
    return;
  }

  try {
    
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isEmail = emailRegex.test(Email_address)


      
    if(!isEmail){
      console.log('Invalid email')
      res.status(400).json({errorMsg:`Invalid email format, try again.`});
      return;
    }

    
      //check if the email entered exists in the database
      const selectQuery = "SELECT * FROM Users WHERE Email_address = ?"

      const [selectResult] = await connection.promise().query(selectQuery, [Email_address]);
              
        if (selectResult.length === 0) {
          console.log('Email does not exist')
          res.status(400).json({errorMsg:'No user found with the provided email or username.'});
          return;
        }

        //Clear the old code first
        const updateQuery = "UPDATE Users SET Verification_code = '000000' WHERE Email_address = ?"

       const [updateResult] = await connection.promise().query(updateQuery,[Email_address]);

          if(updateResult.affectedRows < 0){
            console.log('No rows affected');
            return res.status(500).json({errorMsg:'Failed to update stored verification code'})

          }


          /*//confirm if the initial code has been reset to 000000
          const [verifyReset] = await connection.promise().query(
            "SELECT Verification_code FROM Users_tbl WHERE Email_address = ?",
            [Email_address]);
              console.log('Verification code successfully reset to 000000');*/


        // Small delay before proceeding
          await new Promise(resolve => setTimeout(resolve, 100)); 

  
          //generate code and update it in the database
            const codeGenerated = generateCode();

            const updQuery =  "UPDATE Users SET Verification_code = ? WHERE Email_address = ?"

            const [updtResult] = await connection.promise().query(updQuery, [codeGenerated, Email_address]);
            if(updtResult.affectedRows < 0){
              console.log('New code could not be stored')
              return res.status(500).json({errorMsg:'Error storing verification code.'})
            }

              //console.log('New generated code: ', codeGenerated)

              //retrieve the code stored in the database and print it on the console
              const selQuery =  "SELECT * FROM Users WHERE Email_address = ?"

              const [retrieve] = await connection.promise().query(selQuery, [Email_address]);

              if(retrieve.affectedRows < 0){
                console.log('Database error')
                return res.status(500).json({errorMsg:'Error performing database query'})
              }
              //console.log('Retrieved stored code: ', retrieve[0].Verification_code);

              const credentials = retrieve[0];
              const emailAddress = credentials.Email_address;
              const firstName = credentials.Firstname;
              const username = credentials.Username;
        
          //Send email with verification code to the email submitted
          const transporter = nodemailer.createTransport({
            host:'smtp.gmail.com', //use your smtp host
            port: 465, //ssl port for secure email
            secure: true, //use ssl
            auth: {
              user: 'pm204626@gmail.com', //your email
              pass: 'fsjz hxbo sfbg npcy',// app-specific password
            }
            
          });
          
          
          //Dynamic content
          const emailBody = `
                    <head><style>
                        /*Add stylings to the email body*/
                        body{
                          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                          font-size: 17px;

                        }
                        .header{
                          height: 13%;
                          display:block;
                          margin-top: 0;
                          color:transparent;
                          border-top-left-radius:2px;
                          border-top-right-radius:2px;
                          text-align:center;
                          /*background:linear-gradient(to right bottom, #ef04fc, rgb(138, 239, 182) 80%);*/

                        }
                        .container-wrapper{
                          background-color: rgb(224, 223, 223);
                          margin-left: 10%;
                          margin-right: 10%;
                          margin-top: 10%;
                          margin-bottom: 10%;
                          height: 100%;
                          width: 80%;
                        }
                        .container{
                          background-color: white;
                          color:black;
                          width: 70%;
                          border-radius: 3px;
                          height: fit-content;
                          top: 0;
                          margin-left: 13%;
                          margin-right: 15%;
                          text-align: left;
                          padding: 15px;
                        }
                        
                        .bottom-p{
                          text-align:center;
                          font-size:18px;
                          color:rgb(138, 239, 182);
                        }
                       
                        /*Responsive design for devices with max width of 600px*/
                    @media (max-width: 600px) {
                      body{
                        color:black;
                      }
                      .container{
                        width: 50%;
                        height: fit-content;
                        margin-left: 25%;
                        margin-right: 25%;
                  
                      }
                    }
                    /*Responsive design for devices with max width of 600px*/
                    @media (max-width: 320px) {
                      .container{
                        width: 98%;
                        height: 300px;
                        margin-left: 1%;
                        margin-right: 1%;
                  
                      }
                    }
                      
                        </style>
                            
                        </head>
                        <div class = 'container-wrapper'>
                          <br>
                            <div class = "container">
                                <p><b>Hello</b>, ${firstName}</p>
                                <p style = "color:black;">You requested for a password reset. 
                                <ul>
                                  <li>Your username: ${username}</li>
                                  <li>Verification code: <span style = 'color:fuchsia;font-weight: bolder;font-size:20px;'>${codeGenerated}</span></li>
                                </ul>
                                <p>For your security, do not share with anyone.If it's not you, please ignore or delete it.</p>
                                <p style = "color:black;"><b>Thanks,</b></p>
                                <p style = "color:black;"><b>The P-Way Team</b></p>
                                </div>
                                <br>              
                              <hr>
                              <footer>
                                <p style = 'text-align:center;'>&copy;Copyright 2025 P-Way.com. All Rights Reserved</p>
                              </footer>
                            <br>
                            <br>
                            <br>
                        </div>
                        
                        `;
          
                transporter.verify((error, success) => {
                  if (error) {
                    console.error("Error verifying transporter: ", error);
                  } else {
                    console.log("Transporter is ready to send messages");
                  }
                });
                //Place the options
                const mailoptions = ({
                  //text: 'This is my first email with Emailjs package in Nodejs', //email body
                  from: 'pm204626@gmail.com',//sender email address
                  to: emailAddress, //receiver email address
                  subject: 'Your Password Verification Code', //email subject
                  html: emailBody,
                })
          
              //send the email and get a callback error or message with the sent email details
              transporter.sendMail(mailoptions, (sendErr, sendMsg) =>{
                if(sendErr){
                  console.log('Error sending the email: ', sendErr)
                  res.status(500).send({errorMsg: 'Failed to send email.'})
                  return;
                }
                console.log('Email sent: ' ,sendMsg)
                res.on('finish', () => {console.log('Request pass reset response sent to client.')});
                res.setHeader('Content-Type', 'application/json');
                return res.status(200).json({reqSuccMsg: 'Code has been sent to you. Check your email inbox to proceed.'})

              })
                  
      } catch (error) {
        console.error('Error processing reset request:', error);
        res.status(500).json({ errorMsg: 'Server error, try again later.' });
      }
    });

      



        //Serve the verify code html file
        app.get('/verify_code', (req,res)=>{
          res.sendFile(path.join(__dirname, 'public', 'verify_code.html'))
        })
        app.post('/verify_code', async(req,res)=>{
          const {submitted_code} = req.body;

          console.log('Request body', req.body)

          const email = req.session.email;//retrieve email from session
          console.log('Email stored in session: ', email)

          if(!email){
            return res.status(400).json({errorMsg: 'No email found, session expired. Please request another code.'})
          }


          if(!submitted_code){
            return res.status(400).json({errorMsg: 'Verification code required.'})
           }

           try {
            
          //perform a database query
          const [queryResult] = await connection.promise().query
          ("SELECT * FROM Users WHERE Email_address = ?", [email]);
            
            if(queryResult.length === 0){
            console.log('User not found')
            res.status(400).json({errorMsg: 'No user found with the provided email.'})
            return;
            }

          //convert the submitted code to string and compare them
          //const stringedCode = submitted_code.join('');
          if(submitted_code !== queryResult[0].Verification_code){
            console.log('Codes do not match')
            res.status(400).json({errorMsg:'You have entered an incorrect verification code.'})
  
            return;
          }
          console.log('Generated code: ', queryResult[0].Verification_code)
          console.log('Submitted code: ', submitted_code)
         return res.status(200).json({verifyMsg:'Code verification successfull.'})

          //res.redirect('/reset_password')

          
        } catch (error) {
          console.error('Error processing code verification:', error);
          return res.status(500).json({ errorMsg: 'Server error, try again later.' });
        }
       
  
        })
        
      

      


//Now serve the reset_password html file
app.get('/reset_password', (req, res) =>{
  res.sendFile(path.join(__dirname, 'public', 'reset_password.html'));
})
app.post('/reset_password', async(req, res) => {
        const {Email_address, New_password, Confnew_password} = req.body;

        if(!Email_address || !New_password || !Confnew_password){
          console.log('Please populate fields'); // Debug log
          return res.status(500).json({errorMsg:'Please populate all fields'})

        }

        //validate the email entered
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isEmail = emailRegex.test(Email_address)
       

      if (New_password !== Confnew_password){
        res.status(400).json({msg:'Passwords do not match. Please try again.'})
        return;
      }

      if(New_password.length < 8){
        res.status(400).json({msg:'Password must be at least 8 characters long.'});
        return;
      }

      const newPasSaltRounds = 10;
  
          //Now update the database
          try {
            const newHashedPassword = await bcrypt.hash(New_password, newPasSaltRounds);

            const updateQuery = "UPDATE Users SET User_password = ? WHERE Email_address = ?"

            const [updateResult] = await connection.promise().query(updateQuery, [newHashedPassword, Email_address])

           
          if(updateResult.affectedRows > 0){
            console.log('Password reset successfully. Rows affected: ', updateResult.affectedRows)
            res.status(200).json({resetMsg:'You password is successfully reset. Now use it to login.'})
              return;
          }else{
            console.log('Error updating password column:')
            return res.status(400).json({errorMsg:'User does not exist, please enter the correct email.'});

          }

          } catch (updateerr) {
            console.log('Database update error: ', updateerr)
            return res.status(400).json({errorMsg:'Error resetting password. Try again'})
          }  
    
        });


//Serve the delete_account file
      app.get('/delete_account', (req,res) =>{
        res.sendFile(path.join(__dirname, 'public', 'delete_account.html'))
      })
      app.post('/delete_account', async(req, res) =>{
        const {Email_address} = req.body
        
        if(!Email_address){
          console.log('No email submitted');
          res.status(401).json({deleteErrMsg:'Email or username required'})
          return;
        }
      //validate the email entered
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const isEmail = emailRegex.test(Email_address)

          /*if(!emailRegex.test(Email_address)){
              res.status(400).json({errorMsg:`Invalid email format, try again.`});
              return;
            }*/
          

      try {
        //check if user exists
        const Query = "SELECT * FROM Users WHERE Email_address = ?"
        const [selectResult] = await connection.promise().query(Query, [Email_address]);

          if(selectResult.length === 0){
            console.log('No records for the email entered')
            res.status(400).json({deleteErrMsg:'User does not exist. Incorrect email.'})
            return;
          }

          //console.log('User data: ', selectResult)

          //Now delete records for the email entered from the database
          const delQuery = "DELETE FROM Users WHERE Email_address = ?"
        const [deleteResult] = await connection.promise().query(delQuery, [Email_address]);

        if(deleteResult.affectedRows > 0){
          console.log('Rows affected: ', deleteResult.affectedRows)
          return res.status(200).json({deleteMsg:'Account deletion successfull'})
        }
        console.log('No rows affected in the databse')
        return res.status(400).json({deleteErrMsg:'Failed to delete user account. Please try again.'})

      } catch (error) {
        console.log('Database query error: ', error)
        res.status(500).json({deleteErrMsg:'Error deleting your account'})
        return;
      }
    
    })


    //Serve the security question answers
    app.get('/security-quiz', (req,res) =>{
      res.sendFile(path.join(__dirname, 'public', 'security_quiz.html'))
    })
    app.post('/security_quiz', async(req, res)=>{
      const {Primary_school, Firstdate, Birthday, Parents_Meettown} = req.body;

      if (!Firstdate || !Birthday) {
        console.log('Required fields not populated')
        return res.status(500).json({errorMsg:'Firstdate and birthday required.'})
      }

      const firstdateYear = new Date(Firstdate)
      const currentYear = new Date().getFullYear()

      if (firstdateYear.getFullYear() > currentYear) {
        console.log('Unreasonable date entered')
        return res.status(500).json({errorMsg:'Please enter a realistic date.'})
      }

      
      //carry out the database insert opeartion
      try {
        const [insertAnswers] = await connection.promise().query
        ("INSERT INTO SecurityAnswers (Primary_school, Firstdate, Birthday, Parents_Meettown) VALUES(?, ?, ?, ?)",
         [Primary_school, Firstdate, Birthday, Parents_Meettown])

        if (insertAnswers.affectedRows === 0) {
          console.log('Database insertion error')
          return res.status(500).json({errorMsg:'Error storing data.'})
        }
        console.log('Data insertion successful: ', insertAnswers.affectedRows)
        return res.status(200).json({answerMsg:'Security question setting successful.'})

      } catch (error) {
        console.log('Database error', error.message)
        return res.status(500).json({errorMsg:'Unexpected error has occured, please retry later.'})
      }


    })

    //Now serve the email/phone change request
    app.get('/email_phonechange_req', (req, res) =>{
      res.sendFile(path.join(__dirname, 'public', 'email_phonechange_req.html'))
    })
    app.post('/email_phonechange_req', async(req, res)=>{
      const {Email_address} = req.body

      console.log('Email sent: ', Email_address)

      req.session.email = Email_address;//store the email in session


    if (Email_address === '') {
      console.log('No email entered')
      return res.status(500).json({errorMsg:'Email required.'})

    }

    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const isEmail = emailRegex.test(Email_address)
    //const email = Email_address.trim();

    if (!isEmail) {
      console.log('Incorrect email format')
      return res.status(400).json({errorMsg:'Invalid email format.'});
    }


    
      try {

        
        const [selectResult] = await connection.promise().query("SELECT * FROM Users WHERE Email_address = ?", [Email_address])
       
        if (selectResult.length === 0) {
          console.log('No records for the email entered found in the database.')
            return res.status(500).json({errorMsg:'User with the provided email does not exist.'})

        }
          
        const retrievedEmail = selectResult[0].Email_address;

        if (retrievedEmail !== Email_address) {
          console.log('Unmatching emails')
          return res.status(500).json({errorMsg:'Incorrect email'})
        }
        
        //if user exists then generate, store and send code to their email.
        if (selectResult.length > 0) {
          console.log('User exists. User records: ', selectResult[0])

                //update the stored code to '000000' before inserting the new one.
              const updateQuery = "UPDATE Users SET Verification_code = ? WHERE Email_address = ?"

              const [updateResult] = await connection.promise().query(updateQuery, ['000000', Email_address]);

                if(updateResult.affectedRows < 0){
                  console.log('No rows affected during the verification code reset.');
                  return res.status(500).json({errorMsg:'Failed to update stored verification code'})

                }

  
          //generate code and update it in the database
            const codeGenerated = generateCode();


            const [updtResult] = await connection.promise().query(updateQuery, [codeGenerated, Email_address]);
            if(updtResult.affectedRows === 0){
              console.log('New code could not be stored')
              return res.status(500).json({errorMsg:'Error storing verification code.'})
            }

              //retrieve the code stored in the database and print it on the console

              const [retrieveResult] = await connection.promise().query("SELECT * FROM Users WHERE Email_address = ?", [Email_address]);

              if(retrieveResult.length === 0){
                console.log('Database error')
                return res.status(500).json({errorMsg:'Error performing database query'})
              }

              //const credentials = retrieve[0];
             // const emailAddress = credentials.Email_address;
              const {Firstname:firstName, Username:username} = retrieveResult[0];
        
          //Send email with verification code to the email submitted
          const transporter = nodemailer.createTransport({
            host:'smtp.gmail.com', //use your smtp host
            port: 465, //ssl port for secure email
            secure: true, //use ssl
            auth: {
              user: 'pm204626@gmail.com', //your email
              pass: 'fsjz hxbo sfbg npcy',// app-specific password
            }
            
          });
          
          
          //Dynamic content
          const emailBody = `
                    <head><style>
                        /*Add stylings to the email body*/
                        body{
                          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                          font-size: 17px;

                        }
                        .header{
                          height: 13%;
                          display:block;
                          margin-top: 0;
                          color:transparent;
                          border-top-left-radius:2px;
                          border-top-right-radius:2px;
                          text-align:center;
                          /*background:linear-gradient(to right bottom, #ef04fc, rgb(138, 239, 182) 80%);*/

                        }
                        .container-wrapper{
                          background-color: rgb(224, 223, 223);
                          margin-left: 10%;
                          margin-right: 10%;
                          margin-top: 10%;
                          margin-bottom: 10%;
                          height: 100%;
                          width: 80%;
                        }
                        .container{
                          background-color: white;
                          color:black;
                          width: 70%;
                          border-radius: 3px;
                          height: fit-content;
                          top: 0;
                          margin-left: 13%;
                          margin-right: 15%;
                          text-align: left;
                          padding: 15px;
                        }
                        
                        .bottom-p{
                          text-align:center;
                          font-size:18px;
                          color:rgb(138, 239, 182);
                        }
                       
                        /*Responsive design for devices with max width of 600px*/
                    @media (max-width: 600px) {
                      body{
                        color:black;
                      }
                      .container{
                        width: 50%;
                        height: fit-content;
                        margin-left: 25%;
                        margin-right: 25%;
                  
                      }
                    }
                    /*Responsive design for devices with max width of 600px*/
                    @media (max-width: 320px) {
                      .container{
                        width: 98%;
                        height: 300px;
                        margin-left: 1%;
                        margin-right: 1%;
                  
                      }
                    }
                      
                        </style>
                            
                        </head>
                        <div class = 'container-wrapper'>
                          <br>
                            <div class = "container">
                                <p><b>Hello</b>, ${firstName}</p>
                                <p style = "color:black;">You requested for a password reset. 
                                <ul>
                                  <li>Your username: ${username}</li>
                                  <li>Verification code: <span style = 'color:fuchsia;font-weight: bolder;font-size:20px;'>${codeGenerated}</span></li>
                                </ul>
                                <p>For your security, do not share with anyone.If it's not you, please ignore or delete it.</p>
                                <p style = "color:black;"><b>Thanks,</b></p>
                                <p style = "color:black;"><b>The P-Way Team</b></p>
                                </div>
                                <br>              
                              <hr>
                              <footer>
                                <p style = 'text-align:center;'>&copy;Copyright 2025 P-Way.com. All Rights Reserved</p>
                              </footer>
                            <br>
                            <br>
                            <br>
                        </div>
                        
                        `;
          
                transporter.verify((error, success) => {
                  if (error) {
                    console.error("Error verifying transporter: ", error.message);
                  } else {
                    console.log("Transporter is ready to send messages");
                  }
                });
                //Place the options
                const mailoptions = ({
                  //text: 'This is my first email with Emailjs package in Nodejs', //email body
                  from: 'pm204626@gmail.com',//sender email address
                  to: Email_address, //receiver email address
                  subject: 'Your Password Verification Code', //email subject
                  html: emailBody,
                })
          
              //send the email and get a callback error or message with the sent email details
              transporter.sendMail(mailoptions, (sendErr, sendMsg) =>{
                if(sendErr){
                  console.log('Error sending the email: ', sendErr)
                  res.setHeader('Content-Type', 'application/json');
                  res.status(500).send({errorMsg: 'Failed to send email.'})
                  return;
                }
                console.log('Email sent: ' ,sendMsg)
                res.on('finish', () => {
                  console.log('Request email/phone change response sent to client.');
                });
                res.setHeader('Content-Type', 'application/json');
                return res.status(200).json({reqSuccMsg: 'Code has been sent to you. Check your email inbox to proceed.'})
                
                //res.redirect('/verify_code')//go to next page
              })

            }
            
                  
      } catch (error) {
        console.log('Database error', error.message)
        return res.status(401).json({errorMsg:'Server error. You can retry later.'})
      }
    })




    //Now serve the change email page
    app.get('/change_email', (req, res)=>{
      res.sendFile(path.join(__dirname, 'public', 'change_email.html'))
    })
    app.post('change_email', async(req, res)=>{

      const{Email_address} = req.body

      console.log('The received email: ', req.body.Email_address)

      if (Email_address === '') {
        console.log('No email entered')
        return res.status(500).json({errorMsg:'Email required.'})
  
      }
        
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      const isEmail = emailRegex.test(Email_address)
  
      if (!isEmail) {
        console.log('Incorrect email format')
        return res.status(400).json({errorMsg:'Invalid email format.'});
      }


      try {
        //check if email entered already exists in the databse
        const [emailExists] = await connection.promise().query("SELECT Email_address FROM Users WHERE Email_address = ?", [Email_address]);
        if(emailExists.length > 0){
          console.log('Email already exists: ', emailExists[0])
          return res.status(401).json({errorMsg:'Email already exists, please enter another one.'})
        }

        //Update the email column in the database
        const [emailUpdate] = await connection.promise().query("UPDATE Users SET Email_address = ?", [Email_address])

        if(emailUpdate.affectedRows > 0){
          console.log('Email changed successfully. Affected rows: ', emailUpdate.affectedRows)

          res.setHeader('Content-Type', 'application/json')
          return res.status(200).json({emailSuccMsg: 'Email changed successfuly.'})

        }else{
          console.log('Error updating email')
          return res.status(500).json({errorMsg:'Error changing your email.'})
        }

      } catch (error) {
        console.log('Database error: ', error)
        return res.status(400).json({errorMsg:'Server error, try again later!'})
        
      }


    })
 

    //Serve the change phone file
    app.get('/change_phone', (req, res)=>{
      res.sendFile(path.join(__dirname, 'public', 'change_phone.html'))
    })
    app.post('/change_phone', async(req, res) =>{
      const {Phone_number} = req.body;

      console.log('Recieved phone number: ', req.body.Phone_number)

      if(!Phone_number){
        console.log('No phone number entered.')
        return res.status(401).json({errorMsg:'Phone number required.'})
      }

      if(isNaN(Phone_number)){
        console.log('Input not a number.')
        return res.status(401).json({errorMsg:'Please enter a valid number.'})
      }


      try {

        //check if the number entered exists in database
        const [phoneQuery] = await connection.promise().query("SELECT Phone_number FROM Users WHERE Phone_number = ?", [Phone_number]);

        if(phoneQuery.length > 0){
          console.log('Phone exists: ', phoneQuery[0])
          return res.status(400).json({errorMsg:'Phone entered already exists, please enter another one.'})
        }
        //update the number
        const [updatePhone] = await connection.promise().query("UPDATE Users SET Phone_number = ?", [Phone_number]);

        if(updatePhone.affectedRows > 0){
          console.log('Phone number update successful. Affected rows: ', updatePhone.affectedRows)
          res.setHeader('Content-Type', 'application/json')
          return res.status(200).json({phoneSuccMsg:'Phone change successful.'})
        }else{
          console.log('Error updating phone in the database')
          return res.status(500).json({errorMsg:'Error changing your phone number.'})
        }
      } catch (error) {
        console.log('Database error: ', error)
        return res.status(500).json({errorMsg:'Server error. Try later.'})
      }

    })

    

    //Serve the edit profile form

    //first  fetch data from the database to dynamically update the edit profile form
    app.get('/fetch_data', (req, res) =>{
      const email = req.session.email//email from session
      console.log('Email in session: ', req.session)
      if (!email) {
        console.log('Session expired.')
        res.status(401).json({errorMsg:'User not logged in! Sign in first.'})
        return;

      }

      connection.query('SELECT * FROM Users WHERE Email_address = ?', [email], (fetchErr, fetchResults) =>{
        if (fetchErr) {
          console.log('Error fetching data: ', fetchErr)
          res.status(500).json({errorMsg:'Failed to fetch data.'})
          return;
        }

        if(fetchResults.length === 0){
          console.log('User not found whose data to be fetched.')
          return res.status(500).json({errorMsg:'No user found with this email.'})
        }

        res.json(fetchResults[0])//send data as json
        
      })
  })

  //serve the static files in the public folder
  app.use(express.static('public'))

      
  //serve the form on the edit profile
    app.get('/edit_profile', (req, res) =>{
      res.sendFile(path.join(__dirname, 'public', 'edit_profile.html'))
    })

    app.post('/edit_profile', async(req, res) =>{
      const {Username, Role, Birthdate, Gender, Country, Postal_code, Social_Media_Link} = req.body;

      if (Username === '' || Role === '' || Country === '' || Postal_code === '' ) {
        console.log('Required fields are empty')
        return res.status(401).json({errorMsg:'Asterisked fields required.'})
      }

      try {
        //update the database with the editted data

        const [retrieveUsername] = await connection.promise().query("SELECT Username FROM Users WHERE Username = ?", [Username])
        if (retrieveUsername.length === 0) {
          console.log('No username found')
          return res.status(400).json({errorMsg:'Such username not found.'})
        }

        if (Username !== retrieveUsername[0].Username) {
          console.log('Usernames do not match')
          res.status(500).json({errorMsg:'Incorrect username.'})
          return;
        }

        const [updateResult] = await connection.promise().query
        ('UPDATE Users SET Role = ?, Birthdate = ?, Gender = ?, Country = ?, Postal_code = ?, Social_Media_Link = ? WHERE Username = ?', 
        [Role, Birthdate, Gender, Country, Postal_code, Social_Media_Link, Username])

        if (updateResult.affectedRows === 0) {
          console.log('No row affected')
          return res.status(400).json({errorMsg:'Failed to update your profile!'})
        }else{
          console.log('Database update successful')
          return res.status(200).json({editSuccMsg: 'Profile edited successfully.'})
        }



      } catch (error) {
        console.log('Database error: ', error.message)
        res.status(401).json({errorMsg: 'Seems like server error. Try again later.'})
        
      }


    })


    //Serve the user feedback file
    app.get('/feedback', (req, res) =>{
      res.sendFile(path.join(__dirname, 'public', 'feedback.html'))
    })

    app.post('/feedback', async(req, res) =>{
      const {Email_address, Reporting, Report_Description} = req.body
      
      if (Email_address === '' || Reporting === '' || Report_Description === '') {
        console.log('No feedback data collected')
        res.status(400).json({errorMsg:'All fields required.'})
        return;
      }

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      const isEmail = emailRegex.test(Email_address)
  
      if (!isEmail) {
        console.log('Incorrect email format')
        return res.status(400).json({errorMsg:'Invalid email format.'});
      }

      try {
        /*const selectResult = await connection.promise().query("SELECT * FROM Users WHERE Email_address = ?", [Email_address])

        if (selectResult.length === 0) {
          console.log('Records not found')
          return res.status(401).json({errorMsg:'No user with this email found.'})
        }

        if(Email_address !== selectResult[0].Email_address){
          console.log('Incorrect email')
          return res.status(500).json({errorMsg:'Incorrect email, try again.'})
        }*/

        //continue to insert data
        const insertRes = await connection.promise().query("INSERT INTO UserFeedback (Email_address, Reporting, Report_Description) VALUES (?, ?, ?)", [Email_address, Reporting, Report_Description])

        if (insertRes.affectedRows > 0) {
          console.log('Data insertion successfull')
          return res.status(200).json({errorMsg:'Feedback stored successfully.'})
        }
      } catch (error) {
        console.log('Database error: ', error)
        return res.status(401).json({errorMsg:'Server error. Try again later.'})
      }


    })



    //Serve change shipping address
    app.get('/change_shipping_address', (req, res) =>{
      res.sendFile(path.join(__dirname, 'public', 'change_shipping_address.html'))
    })
    app.post('/change_shipping_address', async(req, res) =>{
      const {shippingOption, Country, County, Nearest_City, Street_Address, Postal_Code} = req.body

      //show the received data from the client
      console.log('Received data: ', req.body)

      //validating shippingOption and shippinOption.checked
      if (!shippingOption) {
        console.log('Shipping option missing')
        return res.status(401).json({errorMsg:'Please, select at least one option.'})
      }

      
        const email = req.session?.email || null;
        if (!email) {
          console.log('Email required to update address. Session expired')
          return res.status(400).json({ errorMsg: 'Email not in session. Log in first.' });
        }

        const streetAddress = Array.isArray(Street_Address) 
        ? Street_Address.find(address => address.trim() !== '')
        :Street_Address || ''


        const postalCode = Array.isArray(Postal_Code)
        ? Postal_Code.find(code => code.trim() !== '') 
        : Postal_Code || ''


        //check to ensure county or country is not empty
        if(shippingOption === 'international'){
          const country = Country || ''
          if (!country) {
            console.log('Country field required for international.')
            return res.status(400).json({errorMsg:'Country field required for international shippings.'})

          }


          const sql = "UPDATE ShippingAddress SET Where_Shipped = 'Internationally', Country = ?, Nearest_City = ?, Street_Address = ?, Postal_Code = ? WHERE Email_address = ?"
          const params = [country, req.body.Nearest_City, streetAddress, postalCode, email]

           // Log SQL and Params
            console.log('SQL Query:', sql);
            console.log('Params:', params);
          try {
            const [result] = await connection.promise().query(sql, params)
            if (result.affectedRows > 0) {
              console.log('Update successful')
              return res.status(200).json({errorMsg:'Your shipping address changed successfully.'})

            }

          } catch (error) {
            console.log('Error updating database: ', error)
            return res.status(400).json({errorMsg:'Failed to change your shipping address.'})
          }

        }

        //shipping address for local
        if (shippingOption === 'local') {
          const county = County || ''
          if (!county) {
            return res.status(500).json({errorMsg:'County field required for local shippings.'})

          }
          const sql = "UPDATE ShippingAddress SET Where_Shipped = 'Locally', County = ?, Nearest_City = ?, Street_Address = ?, Postal_Code = ? WHERE Email_address = ?"
          const params = [county, req.body.Nearest_City, streetAddress, postalCode, email]


           // Log SQL and Params
            console.log('SQL Query:', sql);
            console.log('Params:', params);
          try {
            const [result] = await connection.promise().query(sql, params)
            if (result.affectedRows > 0) {
              console.log('Update successful')
              return res.status(200).json({errorMsg:'Your shipping address changed successfully.'})

            }

          } catch (error) {
            console.log('Error updating database: ', error)
            return res.status(400).json({errorMsg:'Failed to change your shipping address.'})
          }
        }else{
          console.log('No option selected')
          return res.status(500).json({errorMsg:'Invalid or no option selected.'})
        }
    

    })


      //server listen
        app.listen(port, () => {
          console.log('server is up and running on port ' + port)
        })
