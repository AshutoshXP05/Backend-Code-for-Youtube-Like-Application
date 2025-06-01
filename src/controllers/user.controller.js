import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudainary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import { deleteFromCloudinary } from "../utils/deleteFromCloudinary.js";
import mongoose from "mongoose";


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


const refreshAccessToken = asyncHandler( async (req, res) => {
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


const changeUserPassword = asyncHandler( async (req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.body?._id)

   const passwordEntered = await user.isPasswordCorrect(oldPassword)

   if ( ! passwordEntered) {
    throw new ApiError ( 400 , "Invalid old password: " )
   } 

   user.password = oldPassword
  await user.save({validateBeforeSave : false })

  return res
         .status(200)
         .json (
            new ApiResponse( 200, {} , " Password Changed Successfully ")
         )

})


const getCurrentUser = asyncHandler( async (req, res ) => {
     return res
            .status(200)
            .json (
               new ApiResponse( 200, req.user , "Current user fetched successfully " )
            )
})


const updateAccountDetails = asyncHandler( async (req, res) => {
    const {fullName, email} = req.body

    if ( !fullName || !email ) {
        throw new ApiError(400, "All fields are required : ")
    }

   const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        {
            new : true
        }
    ).select ("-password")

    return res
           .status(200)
           .json(
            new ApiResponse(200, user, "Account details updated Successfully ") 
           )
})


const updateUserAvatar = asyncHandler( async (req, res) => {

    const avatarLocalPath =  req.file?.path

    if ( ! avatarLocalPath ) {
        throw new ApiError(400, "Failed to upload avatar to Cloudinary ")
    }

  const avatar =  await uploadOnCloudinary(avatarLocalPath)

  if ( ! avatar ) {
      throw new ApiError(400, "Avatar file is missing ")
  }

  const existingUser = await User.findById(req.user._id)

  const oldAvatarUrl = existingUser?.avatar

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
       $set: {
         avatar : avatar.url
       }
    },
    {
        new : true
    }
   ).select("-password")

   if ( ! user ) {
     throw new ApiError(500, "Failed to update avatar in database ")
   }

   if ( oldAvatarUrl ) {
      await deleteFromCloudinary(oldAvatarUrl)
   }

   return res
          .status(200)
          .json(
            new ApiResponse(200, user, "Avatar updated successfully")
          )

})


const updateUserCoverImage = asyncHandler( async (req, res) => {

    const coverImageLocalPath =  req.file?.path

    if ( ! coverImageLocalPath ) {
        throw new ApiError(400, "Failed to upload cover image to Cloudinary ")
    }

  const coverImage =  await uploadOnCloudinary(coverImageLocalPath)

  if ( ! coverImage ) {
      throw new ApiError(400, "Cover Image file is missing ")
  }

    const existingUser = await User.findById(req.user._id);
    const oldCoverImageUrl = existingUser?.coverImage;

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
       $set: {
         coverImage : coverImage.url
       }
    },
    {
        new : true
    }
   ).select("-password")

    if (!user) {
        throw new ApiError(500, "Failed to update cover image in database.");
    }

    if (oldCoverImageUrl) {
        await deleteFromCloudinary(oldCoverImageUrl);
    }

   return res
          .status(200)
          .json(
            new ApiResponse(200, user, "Cover Image updated successfully")
          )



})


const getUserChannelProfile = asyncHandler( async (req, res) => {

    const {userName} = req.params

    if ( ! userName ) {
        throw new ApiError(400, "UserName is missing ")
    }

    const channel  = await User.aggregate ( [ 
        {
            $match : {
                 userName : userName?.toLowerCase()
            }
        },
        {
            $lookup : {
                from : "subsciptions",
                localField : "_id",
                foreignField : "channel",
                as : "subscribers"
            }
        }, 
          {
            $lookup : {
                from : "subsciptions",
                localField : "_id",
                foreignField : "subscriber",
                as : "subscribedTo"
            }
        },
        {
            $addFields : {
                subscribersCount : {
                    $size : "$subscribers"
                },
                channelsSubsribedToCount : {
                    $size : "$subscribedTo"
                }, 
                isSubscibed: {
                    $cond: {
                        if: { $in : [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            } 
        },
        {
            $project: {
                fullName : 1,
                userName : 1,
                subscribersCount : 1,
                channelsSubsribedToCount : 1,
                isSubscibed : 1,
                avatar : 1,
                coverImage : 1,
                email : 1
            }
        }
    ])

     if ( ! channel?.length) {
        throw new ApiError(404, "Channel does not exist ")
     }

     return res
            .status(200)
            .json (
                new ApiResponse ( 200, channel[0], "User channel fetched Successfully ")
            )

})


const getWatchHistory = asyncHandler ( async (req, res ) => {
     const user = await User.aggregate ( [
        {
            $match: {
                _id: mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline : [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline : [
                                {
                                    $project: {
                                        fullName : 1,
                                        userName: 1,
                                        avatar : 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first : "$owner"
                            }
                        }
                    }
                ]
            }
        }
     ])


     return res
            .status(200) 
            .json(
                new ApiResponse(
                    200, 
                    user[0].getWatchHistory,
                    "Watch History Fetched Successfully: "
                )
            )

})


export {
     registerUser,
     loginUser, 
     logoutUser, 
     refreshAccessToken,
     changeUserPassword,
     getCurrentUser,
     updateAccountDetails,
     updateUserAvatar,
     updateUserCoverImage,
     getUserChannelProfile,
     getWatchHistory
    }