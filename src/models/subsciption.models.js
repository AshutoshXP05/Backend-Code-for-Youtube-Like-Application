import mongoose  from "mongoose";
 
const subsciptionModel = new mongoose.Schema({
     
    subscriber : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User"
    },
    channel : {
         type : mongoose.Schema.Types.ObjectId,
         ref : "User" 
    }
} , { timestamps : true }
)


export const Subsciption = mongoose.model("Subsciption", subsciptionModel)