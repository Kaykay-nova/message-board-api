const port = 3000;
const express = require('express');
const expressSession = require("express-session");
const Joi = require('joi');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { error } = require('console');
const app = express();
app.use(express.json());
app.use(expressSession({
    secret: "a/#$sd#0$",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true
    }
}));
app.listen(port, () => console.log("Listening on port " + port + "..."));

mongoose
  .connect('mongodb://127.0.0.1:27017/message-board', {useNewUrlParser: true})
  .then(() => console.log('Connected to MongoDB!'))
  .catch((error) => console.error('Could not connect to MondoDB... ', error));


//schema
const userSchema = new mongoose.Schema({
  email: {type: String, index: {unique: true}},
  passwordHash: String,
  isAdmin: Boolean
})

const authorSchema = new mongoose.Schema({
  nickName: String,

  name: [userSchema],
})

const commentSchema = new mongoose.Schema({
  title: String,
  author: [authorSchema],
  text: String,
})

const articleSchema = new mongoose.Schema({
  title: String,
  text: String,

  nameAuthor: [authorSchema],
  comments: [commentSchema],
})



//models
const User = mongoose.model("User", userSchema);
const Author = mongoose.model("Author", authorSchema);
const Comment = mongoose.model("Comment", commentSchema);
const Article = mongoose.model("Article", articleSchema);




//API users

app.post("/api/user", (req, res) => {
  const userData = req.body;
  const {error} = validateUser(userData);
  if (error) {
      res.status(400).send(error.details[0].message);
      return;
  }

  const userCreateData = {
      email: userData.email,
      passwordHash: hashPassword(userData.password),
      isAdmin: false
  };

  User.create(userCreateData)
      .then(savedUser => {
          const result = savedUser.toObject();
          delete result.passwordHash;
          res.send(result);
      })
      .catch(e => {
          if (e.code === 11000) {
              res.status(400).send("An account with the given email already exists");
              return;
          }
          res.status(500).send("Error during the registration.");
      });
});

app.post("/api/auth", (req, res) => {
  const loginData = req.body;
  const {error} = validateLogin(req.body);
  if (error) {
      res.status(400).send(error.details[0].message);
      return;
  }
  User.findOne({email: loginData.email})
      .then(user => {
          if (!user || !verifyPassword(user.passwordHash, loginData.password)) {
              res.status(400).send("Email or password not found.");
              return;
          }
          const sessionUser = user.toObject();
          delete sessionUser.passwordHash;
          req.session.user = sessionUser;
          req.session.save((err) => {
              if (err) {
                  res.status(500).send("There was an error during the login process");
                  return;
              }
              res.send(getPublicSessionData(sessionUser));
          });
      })
      .catch(() => res.status(500).send("There was an error while searching for the user."));
});


app.get("/api/auth", (req, res) => {
  const user = req.session.user;
  if (!user) {
      res.status(401).send("Please log in first.");
      return;
  }
  res.send(getPublicSessionData(user));
});

app.delete("/api/auth", (req, res) => {
  req.session.destroy((err) => {
      if (err) {
          res.status(500).send("There was an error while deleting the session.");
          return;
      }
  res.send("The user has been logged out");
  });
});

//API authors

app.post('/authors', (req, res) => {
  const { error } = validateAuthor(req.body);
  if (error) {
    res.status(400).send(error.details[0].message);
  } else {
    req.body.insurance = [];
    Author.create(req.body)
      .then((result) => {
        res.json(result);
      })
      .catch((err) => {
        res.status(500).send(err);
      });
  }
});

app.get('/authors', (req, res) => {
  User.find().then((authors) => res.send(authors));
});

app.get('/authors/:id', (req, res) => {
  const id = String(req.params.id);
  User.findById(id)
    .then((author) => res.send(author))
    .catch((_) => res.status(404).send());
});

app.put('/authors/:id', (req, res) => {
  const id = String(req.params.id);
  const { error } = validateAuthor(req.body);
  if (error) {
    res.status(400).send(error.details[0].message);
  } else {
    Author.findById(id)
      .then((author) => {
        author.nickName = req.body.nickNamename;

        updateAuthor(id, author, res);
      })
      .catch((_) => res.status(404));
  }
});

app.delete('/authors/:id', (req, res) => {
  const id = String(req.params.id);
  Author.deleteOne({ _id: id })
    .then((author) => res.send())
    .catch((err) => res.send(err));
});




//API article (post)

app.post('/authors/:id/article', (req, res) => {
  const id = String(req.params.id);
  Author.findById(id)
    .then((author) => {
      const { error } = validateArticle(req.body);
      if (error) {
        res.status(400).send(error.details[0].message);
      } else {
        author.article.push(req.body);
        Author.findByIdAndUpdate(id, author)
          .then((_) => {
            res.status(200).send('');
          })
          .catch((err) => {
            res.status(500).send(err);
          });
      }
    })
    .catch((_) => res.status(404));
});

app.get('/authors/:aid/article/:id', (req, res) => {
  const authorID = String(req.params.pid);
  const id = String(req.params.id);
  Author.findById(authorID)
    .then((author) => {
      let article = autor.article.find((i) => i._id == id);
      if (!article) {
        res.status(404).send();
      } else {
        res.send(article);
      }
    })
    .catch((_) => res.status(404).send());
});

app.delete('/authors/:aid/article/:articleId', (req, res) => {
  const authorID = String(req.params.aid);
  const articleID = String(req.params.articleId);
  Author.findById(authorID)
    .then((author) => {
      let articles = author.article.filter((i) => i._id != articleID);
      author.article = articles;
      updateAuthor(authorID, author, res);
    })
    .catch((_) => res.status(404).send());
});

app.put('/authors/:aid/article/:articleId', (req, res) => {
  const authorID = String(req.params.aid);
  const articleID = String(req.params.articleId);
  Author.findById(authorID)
    .then((author) => {
      const { error } = validateArticle(req.body);
      if (error) {
        res.status(400).send(error.details[0].message);
      } else {
        let index = author.article.findIndex((i) => i._id == articleID);
        if (index == -1) {
          res.status(404).send();
        } else {
          author.article[index].title = req.body.title;
          author.article[index].text = req.body.text;
          
          updateAuthor(authorID, author, res);
        }
      }
    })
    .catch((_) => res.status(404));
});


// Api comments

//komentáře!!!


//validace

function hashPassword(password, saltRounds = 10) {
  return bcrypt.hashSync(password, saltRounds);
}

function validateUser(data) {
  const schema = Joi.object({
    email: Joi.string().email(),
    password: Joi.string().min(6)
  });

  return schema.validate(data, {presence: "required"});
}


function validateLogin(data) {
  const schema = Joi.object({
      email: Joi.string(),
      password: Joi.string()
  });

  return schema.validate(data, {presence: "required"});
}

function verifyPassword(passwordHash, password) {
  return bcrypt.compareSync(password, passwordHash);
}

function getPublicSessionData(sessionData) {
  const allowedKeys = ["_id", "email", "isAdmin"];
  const entries = allowedKeys
      .map(key => [key, sessionData[key]]);
  return Object.fromEntries(entries);
}

function validateAuthor(author) {
  const schema = Joi.object({
    nickName: Joi.string().min(3).required(),
    name: Joi.array().items(
      Joi.object({
        email: Joi.string().email().required(),
        passwordHash: Joi.string().required(),
        isAdmin: Joi.boolean(),
      })
    ).required(),
  });

  return schema.validate(author);
}



function validateArticle(article) {
  const schema = Joi.object({
    title: Joi.string().min(1),
    text: Joi.string().min(3),
  })

  return schema.validate(article, {presence: "required"});
}
