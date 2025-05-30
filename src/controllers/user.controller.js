import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudainary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler( async ( req, res ) => {
    // res.status(200).json({
    //     message : "Checking on Postman"
    // }) 

    const {fullName, userName, email, password} = req.body
    console.log("email : " , email) ;


    // if ( fullName === "" ) {
    //     throw new ApiError(400, "FullName is required: ")
    // }
    if ( 
        [fullName, userName, email, password].some( (field) => field?.trim === "" ) 
    )
        {
             throw new ApiError(400 , "All fields are required")
        } 

    
    // check either username and email already exist or not 
     
   const existedUser = User.findOne({
    $or: [ {userName}, {email} ]
   })
    
    if ( existedUser ) {
        throw new ApiError(409 , "Either email or UserName already exist : ")
    }

    const avatarLocaPath = req.files?.avatar[0].path

    const coverImageLocaPath = req.files?.coverImage[0].path

    // check if avatar exist or not 
    if ( ! avatarLocaPath ) {
        throw new ApiError(400 , "Avatar file is required : ");
        
    }


    // upload on cloudarily 
   const avator =  await uploadOnCloudinary(avatarLocaPath)
   const coverImage = await uploadOnCloudinary(coverImageLocaPath)

   //check avator successfully uploaded or not 

   if ( ! avator ) {
    throw new ApiError(400, "Avator file is required : ")
   }


   //create user

 const user = await User.create({
      fullName, 
      avator : avator.url,
      coverImage : coverImage.url,
      email, 
      password, 
      userName : userName.toLowerCase()
   })


   //check user actually created or not 
   const createdUser = await User.findById(user._id).select(
     "-password -refreshToken"
   )

   if ( ! createdUser ) {
    throw new ApiError(500, "Something went wrong while registering the user ")
   }

   return res.status(201).json(
      new ApiResponse(200, createdUser, "User created successfully ")
   )

})


export {registerUser}