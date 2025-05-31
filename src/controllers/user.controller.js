import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudainary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"


const generateAccessandRefereshToken = async ( userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save( {validateBeforeSave : false} )

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError ( 500, "Something went wrong while generating refresh and access tokens")
    }
}


const registerUser = asyncHandler( async ( req, res ) => {
    // res.status(200).json({
    //     message : "Checking on Postman"
    // }) 

    const {fullName, userName, email, password} = req.body
    // console.log("email : " , email) ;


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
     
   const existedUser = await User.findOne({
    $or: [{ userName }, { email }],
  });
    
    if ( existedUser ) {
        throw new ApiError(409 , "Either email or UserName already exist : ")
    }

    const avatarLocaPath = req.files?.avatar[0].path

    // const coverImageLocaPath = req.files?.coverImage[0].path

    let coverImageLocaPath;
    if ( req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0 ) {
        coverImageLocaPath = req.files.coverImage[0].path
    }

    // check if avatar exist or not 
    if ( ! avatarLocaPath ) {
        throw new ApiError(400 , "Avatar file is required : ");
        
    }


    // upload on cloudarily 
   const avatar =  await uploadOnCloudinary(avatarLocaPath)
   const coverImage = await uploadOnCloudinary(coverImageLocaPath)

   //check avatar successfully uploaded or not 

   if ( ! avatar ) {
    throw new ApiError(400, "Avator file is required : ")
   }


   //create user

 const user = await User.create({
      fullName, 
      avatar : avatar.url,
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

const loginUser = asyncHandler(async (req, res) => {
      
    const {userName, email, password} = req.body

    if ( !userName && !email  ) {
        throw new ApiError( 400 , "UserName or email must be filled : ")
    }

   const user = await User.findOne ( {
        $or: [{userName} , {email}]
    }).select("+password")

    if ( ! user ) {
        throw new ApiError(404, "User does not exist ")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

     if ( ! isPasswordValid ) {
        throw new ApiError(401, "Password is not correct ")
    }

  const {accessToken, refreshToken} = await generateAccessandRefereshToken(user._id)

  const loggedInUser = await User.findById(user._id).select (
    "-password -refreshToken"
  )

  // cookies 
  const options = {
    httpOnly : true, 
    secure: true
  }

  return  res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshToken, options)
  .json(
    new ApiResponse(
        200, 
        {
            user: loggedInUser, accessToken, refreshToken
        },
        "User loggin in Successfully"
    )
  )

})



const logoutUser = asyncHandler( async (req, res) => {
    
   await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                refreshToken : undefined
            }
        },
        {
            new: true
        }
    )

   const options = {
       httpOnly : true,
       secure : true
   }

   return res
   .status(200)
   .clearCookie("accessToken", options)
   .clearCookie("refreshToken", options)
   .json (
      new ApiResponse(200, {}, "User Logged out ")
   )

})


const refreshAccessToken = asyncHandler( async () => {
    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken

    if ( ! incomingRefreshToken ) {
        throw new ApiError(401, "Unauthorized request : ")
    }

    try {
        const decodedToken = jwt.verify(
           incomingRefreshToken,
           process.env.REFRESH_TOKEN_SECRET
       )
    
      const user = await User.findById(decodedToken?._id)
    
       if ( ! user ) {
        throw new ApiError(401, "Invalid refresh Token")
       }
    
       if ( incomingRefreshToken !== user?.refreshToken ) {
           throw new ApiError(401, "Refresh token is expired or used ")
       }
    
        const options = {
              httpOnly : true,
              secure : true
        }
    
        const {accessToken, newRefreshToken } = await generateAccessandRefereshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json (
             new ApiResponse (
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access token Refreshed"
             )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})


export {registerUser, loginUser, logoutUser, refreshAccessToken}