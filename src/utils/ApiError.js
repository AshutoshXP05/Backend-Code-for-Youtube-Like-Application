class ApiError extends Error {
     constuctor(
         statusCode, 
         message = "Something went wrong ", 
         error = [],
         statck = ""
     ) {
         super(message)
         this.statusCode = statusCode
         this.data = null
         this.message = message
         this. error = error
         this.success = false

         if ( statck ) {
            this.statck = statck
         } else {
            Error.captureStackTrace(this, this.constuctor)
         }
     }
}

export {ApiError}