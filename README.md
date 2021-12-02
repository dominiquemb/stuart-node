# stuart-node

This is a demo for Stuart, allowing couriers to register their capacity and allowing a dispatcher to lookup couriers that match requirements.

Add these details in an .env file in the root folder:

```
MONGODB_URI=mongodb+srv://stuartadmin:weioZBEkkSAanDWD@cluster0.dahed.mongodb.net/myFirstDatabase?retryWrites=true&w=majority
DB_NAME=stuart
```

For tests, create a file named jestSetup in the root folder and add this into it:

```
process.env.MONGODB_URI="mongodb+srv://stuartadmin:weioZBEkkSAanDWD@cluster0.dahed.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
process.env.DB_NAME="stuart-test";
```

Now, install dependencies and start the server:

1. npm install --save
2. Make sure jest is installed globally by running `npm install -g jest`
3. npm run start

How to perform tests:

Simply run `jest`
