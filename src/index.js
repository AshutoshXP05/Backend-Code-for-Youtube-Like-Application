// require('dotenv').config({path: './env'})
import dotenv from "dotenv"

// import mongoose  from "mongoose";
// import { DB_NAME } from "./constants";
import connectDB  from "./db/index.js";
import { app } from "./app.js";

dotenv.config( { 
    path : './env'
})


connectDB()
.then( () => {
     app.listen(process.env.PORT || 8000 , () => {
      console.log(`Server is running at port : ${process.env.PORT}` );
      
    })
}) 
.catch( (err) => {
  console.log(("MongoDB connection Error !! " , err));
  
})


/*

import express from "express"
const app = express()



(async () => {
    try {
      await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
      app.on("error", (error ) => {
        console.log("ERROR in talking with Database : ", error );
        throw error 
        
      })

      app.listen(process.env.port, () => {
        console.log(`App is listening on port ${process.env.PORT}`);
        
      } )
    } catch ( error ) {
        console.log("ERROR : ", error );
        
    }
} ) ()

*/