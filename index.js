const express=require("express");
const app=express();
const {open}=require("sqlite")
const path=require("path")
const dbPath=path.join(__dirname,"userTweets.db");
const jwt=require("jsonwebtoken");
const sqlite3=require("sqlite3")
const bcrypt=require("bcrypt");
app.use(express.json());
let db=null;
const initializeDBAndServer=async ()=>{
    try{
        db=await open({
            filename:dbPath,
            driver:sqlite3.Database
        })
        app.listen(3000,()=>{
            console.log("app is running on the server")
        });
    }catch(e){
        console.log(`DB Error:${e.message}`);
        process.exit(1)
    }
}
initializeDBAndServer() 
const getTweet=(eachTweet)=>{
    return {
        _id:eachTweet._id,
        userId:eachTweet.user_id,
        text:eachTweet.text,
        createdAt:eachTweet.created_at
    }
}
const authenticateToken=(request,response,next)=>{
    let jwtToken=""
    const authHeader=request.headers['authorization'];
    if (authHeader!==undefined){
        jwtToken=authHeader.split(" ")[1]
    }
    if(jwtToken===undefined){
        response.status(401);
        response.send("Access Token Needed")
    }else{
        jwt.verify(jwtToken,"jwt_token",async (error,user)=>{
            if (error){
                response.status(401);
                response.send("Invalid Access Token")
            }else{
                request.user=user;
                next();
            }
        })
    }
}
app.post("/api/users/register/",async (request,response)=>{
    const {username,password}=request.body 
    const getUserQuery=`
        SELECT 
            * 
        FROM 
            user 
        WHERE 
            username='${username}';
    `;
    const dbUser=await db.get(getUserQuery);
    if (dbUser!==undefined){
        response.status(400)
        response.send("User Already Exists")
    }else{
        const hashedPassword=await bcrypt.hash(password,10);
        const createQuery=`
            INSERT INTO user  
                (username,password) 
            VALUES 
                ('${username}','${hashedPassword}')
        `;
        await db.run(createQuery);
        response.send("user created");
    }
})
app.get("/",async (request,response)=>{
    response.send("Deployment Successfull")
})
app.post("/api/users/login/",async (request,response)=>{
    const {username,password}=request.body 
    const getUser=`
        SELECT * 
        FROM 
            user 
        WHERE 
            username='${username}';
    `;
    const dbUser=await db.get(getUser);
    if (dbUser===undefined){
        response.status(400);
        response.send("Invalid User")
    }else{
        const isPasswordCorrect=await bcrypt.compare(password,dbUser.password);
        if (isPasswordCorrect){
            const payLoad={username:username,id:dbUser._id};
            const jwtToken=jwt.sign(payLoad,"jwt_token");
            response.send(jwtToken)
        }else{
            response.status(400);
            response.send("Invalid Password")
        }
    }
})
app.post("/api/tweets/",authenticateToken,async (request,response)=>{
    const {userId,text,createdAt}=request.body;
    const {user}=request;
    const getUser=`
        SELECT * FROM user WHERE username='${user.username}';
    `;
    const dbUser=await db.get(getUser);
    console.log(dbUser);
    if (userId!==dbUser._id){
        response.status(400);
        response.send("Access Not Allowed")
    }else{
        const postTweetQuery=`
            INSERT INTO tweets 
                (user_id,text,created_at)
            VALUES 
                (${userId},'${text}',DATE('now'));
        `;
        await db.run(postTweetQuery);
        response.send("Tweet Added");
    }
})
app.get("/api/users/:userId/timeline/",authenticateToken,async(request,response)=>{
    const {userId}=request.params;
    const userTweetsQuery=`
        SELECT 
            * 
        FROM 
            tweets 
        WHERE 
            user_id=${userId}
        ORDER BY 
            created_at DESC;
    `;
    const userTweets=await db.all(userTweetsQuery);
    response.send(userTweets.map((eachTweet)=>{
        return getTweet(eachTweet)
    }))
})
module.exports=app;