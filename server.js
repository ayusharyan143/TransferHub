var express = require("express");
var app = express();
var httpObj = require("http");
var http = httpObj.createServer(app);

const port = process.env.PORT || 3000;

var mainURL = `http://localhost:${port}`;

var mongodb = require("mongodb");
var mongoClient = mongodb.MongoClient;
var ObjectId = mongodb.ObjectId;

var formidable = require("express-formidable");
app.use(formidable());

var bcrypt = require("bcrypt");
var nodemailer = require("nodemailer");

var nodemailerForm = "test123@gmail.com"; // provide your mail
var nodemailerObject = {
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "test123@gmail.com", // provide your mail
    pass: "", // ensure this is correct this will get from you mail setting ( app password )
  },
};

// Define publicly accessible folders
app.use("/public/css", express.static(__dirname + "/public/css"));
app.use("/public/js", express.static(__dirname + "/public/js"));
app.use(
  "/public/font-awesome-4.7.0",
  express.static(__dirname + "/public/font-awesome-4.7.0")
);
app.use("/public/img", express.static(__dirname + "/public/img"));
app.use("/Loginpublic/img", express.static(__dirname + "/Loginpublic/img"));
app.use("/public/fonts", express.static(__dirname + "/public/fonts"));

app.set("view engine", "ejs");

var session = require("express-session");
const { type } = require("os");
app.use(
  session({
    secret: "secret key",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(function (request, result, next) {
  request.mainURL = mainURL;
  request.isLogin = typeof request.session.user !== "undefined";
  request.user = request.session.user;

  next();
});

var fileSystem = require("fs");

var rimraf = require("rimraf");
console.log(rimraf);

// recursive function to get the folder from uploaded
function recursiveGetFolder(files, _id) {
  var singleFile = null;

  for (var a = 0; a < files.length; a++) {
    const file = files[a];

    // return if file type is folder and ID is found

    if (file.type == "folder") {
      if (file._id == _id) {
        return file;
      }

      // if it has files , then do the recursion

      if (file.type == "folder" && file.files.length > 0) {
        singleFile = recursiveGetFolder(file.files, _id);

        // return the file if found in sub-folders
        if (singleFile != null) {
          return singleFile;
        }
      }
    }
  }
}

// Recursive function to get the file from uploaded folders
function recursiveGetFile(files, _id) {
  let singleFile = null;

  for (var a = 0; a < files.length; a++) {
    const file = files[a];

    if (file.type != "folder") {
      if (file._id == _id) {
        return file;
      }
    }

    if (file.type == "folder" && file.files.length > 0) {
      singleFile = recursiveGetFile(file.files, _id);

      if (singleFile != null) {
        return singleFile;
      }
    }
  }
}

// function to add new uploaded object and return the updated array
function getUpdatedArray(arr, _id, uploadedObj) {
  for (var a = 0; a < arr.length; a++) {
    // push in files array if type is folder and ID is found
    if (arr[a].type == "folder") {
      if (arr[a]._id == _id) {
        arr[a].files.push(uploadedObj);
        arr[a]._id = ObjectId(arr[a]._id);
      }

      // if it has files, then do the recursion
      if (arr[a].files.length > 0) {
        arr[a]._id = ObjectId(arr[a]._id);
        getUpdatedArray(arr[a].files, _id, uploadedObj);
      }
    }
  }

  return arr;
}

// recursive function to remove the file and return the updated array
function removeFileReturnUpdate(arr, _id) {
  for (var a = 0; a < arr.length; a++) {
    if (arr[a].type != "folder" && arr[a]._id == _id) {
      // remove the file from uploads folder

      try {
        fileSystem.unlinkSync(arr[a].filePath);
      } catch (exp) {
        //
      }
      arr.splice(a, 1);
      break;
    }

    // do the recursion if it has sub-folders

    if (arr[a].type == "folder" && arr[a].files.length > 0) {
      arr[a]._id = ObjectId(arr[a]._id);

      removeFileReturnUpdate(arr[a].files, _id);
    }
  }

  return arr;
}

// function to remove the folder and return the updated array
function removeFolderReturnUpdated(arr, _id) {
  for (let a = 0; a < arr.length; a++) {
    if (arr[a].type == "folder") {
      if (arr[a]._id == _id) {
        // Remove the folder with all sub-directories
        try {
          rimraf.sync(arr[a].folderPath); // No callback needed
          console.log("Removed Folder with all sub-directories.");
        } catch (err) {
          console.error("Error removing folder:", err);
        }

        arr.splice(a, 1);
        break;
      }

      if (arr[a].files.length > 0) {
        arr[a]._id = ObjectId(arr[a]._id);
        removeFolderReturnUpdated(arr[a].files, _id);
      }
    }
  }

  return arr;
}

// function to get the shared folder
function recursiveGetSharedFolder(files, _id) {
  var singleFile = null;

  for (var a = 0; a < files.length; a++) {
    var file = typeof files[a].file == "undefined" ? files[a] : files[a].file;

    // Return if file type is folder and ID is found
    if (file.type == "folder") {
      if (file._id == _id) {
        return file;
      }

      // If it has files, then do the recursion
      if (file.files.length > 0) {
        singleFile = recursiveGetSharedFolder(file.files, _id);

        // Return the file if found in sub-folders
        if (singleFile != null) {
          return singleFile;
        }
      }
    }
  }
}

// function to remove the shared folder and return the updated array
function removeSharedFolderReturnUpdated(arr, _id) {
  for (var a = 0; a < arr.length; a++) {
    var file = typeof arr[a].file === "undefined" ? arr[a] : arr[a].file;

    if (file.type == "folder") {
      if (file._id == _id) {
        arr.splice(a, 1);

        break;
      }

      //  do the recursion if it has sub-folder

      if (file.files.length > 0) {
        file._id = ObjectId(file._id);

        removeSharedFolderReturnUpdated(file.files, _id);
      }
    }
  }

  return arr;
}

// function to deleted shared file
function removeSharedFileReturnUpdated(arr, _id) {
  for (var a = 0; a < arr.length; a++) {
    var file = typeof arr[a].file === "undefined" ? arr[a] : arr[a].file;

    // Remove the file if found
    if (file.type != "folder" && file._id == _id) {
      arr.splice(a, 1);
      break;
    }

    if (file.type == "folder" && file.files.length > 0) {
      arr[a]._id = ObjectId(arr[a]._id);
      removeSharedFileReturnUpdated(file.files, _id);
    }
  }
  return arr;
}

// function to get the shared file
function recursiveGetSharedFile(files, _id) {
  var singleFile = null;

  for (var a = 0; a < files.length; a++) {
    var file = typeof files[a].file === "undefined" ? files[a] : files[a].file;

    // return if file type is not folder and ID is found

    if (file.type != "folder") {
      if (file._id == _id) {
        return file;
      }
    }

    // if it is a folder and have files , then do the recursion

    if (file.type == "folder" && file.files.length > 0) {
      singleFile = recursiveGetSharedFile(file.files, _id);

      // return the file if found in sub-folder

      if (singleFile != null) {
        return singleFile;
      }
    }
  }
}

// function to rename the sub-folders
function renameSubFolders(arr, oldName, newName) {
  for (var a = 0; a < arr.length; a++) {
    // set new folder path by splitting it in parts by "/"
    var pathParts =
      arr[a].type == "folder"
        ? arr[a].folderPath.split("/")
        : arr[a].filePath.split("/");

    var newPath = "";

    for (var b = 0; b < pathParts.length; b++) {
      // replacce the old name with new name
      if (pathParts[b] == oldName) {
        pathParts[b] = newName;
      }

      newPath += pathParts[b];

      // append "/" at the end , except the last index
      if (b < pathParts.length - 1) {
        newPath += "/";
      }
    }

    if (arr[a].type == "folder") {
      arr[a].folderPath = newPath;

      if (arr[a].files.length > 0) {
        renameSubFolders(arr[a].files, _id, newName);
      }
    } else {
      arr[a].filePath = newPath;
    }
  }
}

// function to rename the folders
function renameFolderReturnUpdated(arr, _id, newName) {
  for (var a = 0; a < arr.length; a++) {
    if (arr[a].type == "folder") {
      if (arr[a]._id == _id) {
        const oldFolderName = arr[a].folderName;
        var folderPathParts = arr[a].folderPath.split("/");

        var newFolderPath = "";

        for (var b = 0; b < folderPathParts.length; b++) {
          // replace the old path with new
          if (folderPathParts[b] == oldFolderName) {
            folderPathParts[b] = newName;
          }

          newFolderPath += folderPathParts[b];

          // append "/" at the end, except for last index
          if (b < folderPathParts.length - 1) {
            newFolderPath += "/";
          }
        }

        // rename the fodler
        fileSystem.rename(arr[a].folderPath, newFolderPath, function (error) {
          //
        });

        // update the array values
        arr[a].folderName = newName;
        arr[a].folderPath = newFolderPath;

        // update the sub folders path
        renameSubFolders(arr[a].files, oldFolderName, newName);

        break;
      }

      if (arr[a].files.length > 0) {
        renameFolderReturnUpdated(arr[a].files, _id, newName);
      }
    }
  }

  return arr;
}

// function to rename the file
function renameFileReturnUpdated(arr, _id, newName) {
  for (var a = 0; a < arr.length; a++) {
    if (arr[a].type != "folder") {
      if (arr[a]._id == _id) {
        const oldFileName = arr[a].name;
        var filePathParts = arr[a].filePath.split("/");

        var newFilePath = "";

        for (var b = 0; b < filePathParts.length; b++) {
          // replace the old path with new
          if (filePathParts[b] == oldFileName) {
            filePathParts[b] = newName;
          }

          newFilePath += filePathParts[b];

          // append "/" at the end, except for last index
          if (b < filePathParts.length - 1) {
            newFilePath += "/";
          }
        }

        // rename the fodler
        fileSystem.rename(arr[a].filePath, newFilePath, function (error) {
          //
        });

        // update the array values
        arr[a].name = newName;
        arr[a].filePath = newFilePath;

        break;
      }
    }

    // do the recursion if folder has sub-folders
    if (arr[a].type == "folder" && arr[a].files.length > 0) {
      renameFileReturnUpdated(arr[a].files, _id, newName);
    }
  }

  return arr;
}

// function to search uploaded files
function recursiveSearch(files, query) {
  var singleFile = null;

  for (var a = 0; a < files.length; a++) {
    const file = files[a];

    if (file.type == "folder") {
      // search folder case-insensitive
      if (file.folderName.toLowerCase().search(query.toLowerCase()) > -1) {
        return file;
      }

      if (file.files.length > 0) {
        singleFile = recursiveSearch(file.files, query);
        if (singleFile != null) {
          // need parent folder in case of files
          if (singleFile.type != "folder") {
            singleFile.parent = file;
          }
          return singleFile;
        }
      }
    } else {
      if (file.name.toLowerCase().search(query.toLowerCase()) > -1) {
        return file;
      }
    }
  }
}

// function to search shared files
function recursiveSearchShared(files, query) {
  var singleFile = null;

  for (var a = 0; a < files.length; a++) {
    var file = typeof files[a].file === "undefined" ? files[a] : files[a].file;

    if (file.type == "folder") {
      if (file.folderName.toLowerCase().search(query.toLowerCase()) > -1) {
        return file;
      }

      if (file.files.length > 0) {
        singleFile = recursiveSearchShared(file.files, query);
        if (singleFile != null) {
          if (singleFile.type != "folder") {
            singleFile.parent = file;
          }
          return singleFile;
        }
      }
    } else {
      if (file.name.toLowerCase().search(query.toLowerCase()) > -1) {
        return file;
      }
    }
  }
}

// Start the server
http.listen(3000, function () {
  console.log("Server started at " + mainURL);

  mongoClient.connect(
    "mongodb://localhost:27017",
    {
      useUnifiedTopology: true,
    },
    function (error, client) {
      if (error) {
        console.error("Error connecting to database: ", error);
        return;
      }
      database = client.db("file_transfer");
      console.log("Database connected.");

      // blog route
      app.get("/Blog", async function (request, result) {
        // Example blog posts data
        const blogPosts = [
          {
            title: "First Blog Post",
            image: "/path/to/image1.jpg",
            content: "Content of the first post",
          },
          {
            title: "Second Blog Post",
            image: "/path/to/image2.jpg",
            content: "Content of the second post",
          },
          // Add more posts as needed...
        ];

        // Render the Blog template and pass the blogPosts data
        result.render("Blog", {
          request: request,
          blogPosts: blogPosts, // Passing blogPosts to the EJS template
        });
      });

      // search files or folders
      app.get("/Search", async function (request, result) {
        console.log('Request query inside "/Search" : ', request.query);
        const search = request.query.search;

        if (request.session.user) {
          var user = await database.collection("users").findOne({
            _id: ObjectId(request.session.user._id),
          });
          var fileUploaded = await recursiveSearch(user.uploaded, search);
          var fileShared = await recursiveSearchShared(
            user.sharedWithMe,
            search
          );

          // check if file is uploaded or shared with user
          if (fileUploaded == null && fileShared == null) {
            request.status = "error";
            request.message =
              "File/folder '" +
              search +
              "' is neither uploaded nor shared with you.";

            result.render("Search", {
              request: request,
            });
            return false;
          }

          var file = fileUploaded == null ? fileShared : fileUploaded;
          file.isShared = fileUploaded == null;
          result.render("Search", {
            request: request,
            file: file,
          });

          return false;
        }

        result.redirect("/Login");
      });

      // sharedlink delete route
      app.post("/DeleteLink", async function (request, result) {
        const _id = request.fields._id;

        if (request.session.user) {
          var link = await database.collection("public_links").findOne({
            $and: [
              {
                "uploadedBy._id": ObjectId(request.session.user._id),
              },
              {
                _id: ObjectId(_id),
              },
            ],
          });

          if (link == null) {
            request.session.status = "error";
            request.session.message = "Link does not exists.";

            const backURL = request.header("Referer") || "/";
            result.redirect(backURL);
            return false;
          }

          await database.collection("public_links").deleteOne({
            $and: [
              {
                "uploadedBy._id": ObjectId(request.session.user._id),
              },
              {
                _id: ObjectId(_id),
              },
            ],
          });

          request.session.status = "success";
          request.session.message = "Link has been deleted.";

          const backURL = request.header("Referer") || "/";
          result.redirect(backURL);
          return false;
        }

        result.redirect("/Login");
      });

      // my shared links route
      app.get("/MySharedLinks", async function (request, result) {
        if (request.session.user) {
          var links = await database
            .collection("public_links")
            .find({
              "uploadedBy._id": ObjectId(request.session.user._id),
            })
            .toArray();

          result.render("MySharedLinks", {
            request: request,
            links: links,
          });
          return false;
        }

        result.redirect("/Login");
      });

      // share via link rout
      app.get("/SharedViaLink/:hash", async function (request, result) {
        const hash = request.params.hash;

        var link = await database.collection("public_links").findOne({
          hash: hash,
        });

        if (link == null) {
          request.session.status = "error";
          request.session.message = "Link expired.";

          result.render("SharedViaLink", {
            request: request,
          });
          return false;
        }

        result.render("SharedViaLink", {
          request: request,
          link: link,
        });
      });

      // sharefile by link rout
      app.post("/ShareViaLink", async function (request, result) {
        const _id = request.fields._id;

        if (request.session.user) {
          var user = await database.collection("users").findOne({
            _id: ObjectId(request.session.user._id),
          });

          var file = await recursiveGetFile(user.uploaded, _id);
          var folder = await recursiveGetFolder(user.uploaded, _id);

          if (file == null && folder == null) {
            request.session.status = "error";
            request.session.message = "File does not exists";

            const backURL = request.header("Referer") || "/";
            result.redirect(backURL);
            return false;
          }

          bcrypt.hash(file.name, 10, async function (error, hash) {
            hash = hash.substring(10, 20);
            const link = mainURL + "/SharedViaLink/" + hash;
            await database.collection("public_links").insertOne({
              hash: hash,
              file: file,
              uploadedBy: {
                _id: user._id,
                name: user.name,
                email: user.email,
              },
              createdAt: new Date().getTime(),
            });

            request.session.status = "success";
            request.session.message = "Share link: " + link;

            const backURL = request.header("Referer") || "/";
            result.redirect(backURL);
          });

          return false;
        }

        result.redirect("/Login");
      });

      // rename file route
      app.post("/RenameFile", async function (request, result) {
        const _id = request.fields._id;
        const name = request.fields.name;

        if (request.session.user) {
          var user = await database.collection("users").findOne({
            _id: ObjectId(request.session.user._id),
          });

          var updatedArray = await renameFileReturnUpdated(
            user.uploaded,
            _id,
            name
          );

          for (var a = 0; a < updatedArray.length; a++) {
            updatedArray[a]._id = ObjectId(updatedArray[a]._id);
          }

          await database.collection("users").updateOne(
            {
              _id: ObjectId(request.session.user._id),
            },
            {
              $set: { uploaded: updatedArray },
            }
          );

          const backURL = request.header("Referer") || "/";
          result.redirect(backURL);

          return false;
        }

        result.redirect("/Login");
      });

      // rename folder route
      app.post("/RenameFolder", async function (request, result) {
        const _id = request.fields._id;
        const name = request.fields.name;

        if (request.session.user) {
          var user = await database.collection("users").findOne({
            _id: ObjectId(request.session.user._id),
          });

          var updatedArray = await renameFolderReturnUpdated(
            user.uploaded,
            _id,
            name
          );

          for (var a = 0; a < updatedArray.length; a++) {
            updatedArray[a]._id = ObjectId(updatedArray[a]._id);
          }

          await database.collection("users").updateOne(
            {
              _id: ObjectId(request.session.user._id),
            },
            {
              $set: { uploaded: updatedArray },
            }
          );

          const backURL = request.header("Referer") || "/";
          result.redirect(backURL);

          return false;
        }

        result.redirect("/Login");
      });

      // Download file route
      app.post("/DownloadFile", async function (request, result) {
        const _id = request.fields._id;

        if (request.session.user) {
          var user = await database.collection("users").findOne({
            _id: ObjectId(request.session.user._id),
          });

          var fileUploaded = await recursiveGetFile(user.uploaded, _id);

          var fileShared = await recursiveGetSharedFile(user.sharedWithMe, _id);

          if (fileUploaded == null && fileShared == null) {
            result.json({
              status: "error",
              message: "File is neither uploaded nor shared with you.",
            });

            return false;
          }

          var file = fileUploaded == null ? fileShared : fileUploaded;

          fileSystem.readFile(file.filePath, function (error, data) {
            result.json({
              status: "success",
              message: "Data  has been fetched.",
              arrayBuffer: data,
              fileType: file.type,
              fileName: file.name,
            });
          });

          return false;
        }

        result.json({
          status: "error",
          message: "Please login to perform this action.",
        });

        return false;
      });

      // pro-version
      app.get("/pro-versions", function (request, result) {
        result.render("proVersions", {
          request: request,
        });
      });

      //  delete shared file
      app.post("/DeleteSharedFile", async function (request, result) {
        const _id = request.fields._id;

        if (request.session.user) {
          var user = await database.collection("users").findOne({
            _id: ObjectId(request.session.user._id),
          });

          var updatedArray = await removeSharedFileReturnUpdated(
            user.sharedWithMe,
            _id
          );

          for (var a = 0; a < updatedArray.length; a++) {
            updatedArray[a]._id = ObjectId(updatedArray[a]._id);
          }

          await database.collection("users").updateOne(
            {
              _id: ObjectId(request.session.user._id),
            },
            {
              $set: {
                sharedWithMe: updatedArray,
              },
            }
          );

          const backURL = request.header("Referer") || "/";

          result.redirect(backURL);

          return false;
        }

        result.redirect("/Login");
      });

      // deleted shared folder
      app.post("/DeleteSharedDirectory", async function (request, result) {
        const _id = request.fields._id;

        if (request.session.user) {
          var user = await database.collection("users").findOne({
            _id: ObjectId(request.session.user._id),
          });

          var updatedArray = await removeSharedFolderReturnUpdated(
            user.sharedWithMe,
            _id
          );

          for (var a = 0; a < updatedArray.length; a++) {
            updatedArray[a]._id = ObjectId(updatedArray[a]._id);
          }

          await database.collection("users").updateOne(
            { _id: ObjectId(request.session.user._id) },
            {
              $set: {
                sharedWithMe: updatedArray,
              },
            }
          );

          const backURL = request.header("Referer") || "/";

          result.redirect(backURL);

          return false;
        }

        result.redirect("/Login");
      });

      // shared with me
      app.get("/SharedWithMe/:_id?", async function (request, result) {
        const _id = request.params._id;

        if (request.session.user) {
          var user = await database
            .collection("users")
            .findOne({ _id: ObjectId(request.session.user._id) });

          var files = null;
          var folderName = "";

          if (typeof _id == "undefined") {
            files = user.sharedWithMe;
          } else {
            var folderObj = await recursiveGetSharedFolder(
              user.sharedWithMe,
              _id
            );

            if (folderObj == null) {
              request.status = "error";
              request.message = "Folder not found.";
              result.render("Error", { request: request });

              return false;
            }
            files = folderObj.files;
            folderName = folderObj.folderName;
          }

          if (files == null) {
            request.status = "error";
            request.message = "Directory not found.";
            result.render("Error", { request: request });

            return false;
          }

          result.render("SharedWithMe", {
            request: request,
            files: files,
            _id: _id,
            folderName: folderName,
          });

          return false;
        }

        result.redirect("/Login");
      });

      // remove shared access
      app.post("/RemoveSharedAccess", async function (request, result) {
        const _id = request.fields._id;

        if (request.session.user) {
          // Try to find the user with the given conditions
          const user = await database.collection("users").findOne({
            $and: [
              { "sharedWithMe._id": ObjectId(_id) },
              {
                "sharedWithMe.sharedBy._id": ObjectId(request.session.user._id),
              },
            ],
          });

          // Check if the user was found and if the 'sharedWithMe' field exists
          if (!user || !user.sharedWithMe) {
            // If no user is found or 'sharedWithMe' is missing, send an error response
            request.session.status = "error";
            request.session.message = "No matching shared access found.";
            result.redirect("/Login");
            return;
          }

          // Remove from array
          for (var a = 0; a < user.sharedWithMe.length; a++) {
            if (user.sharedWithMe[a]._id.toString() === _id) {
              user.sharedWithMe.splice(a, 1);
              break; // Exit loop after removing the item
            }
          }

          // Update the user document in the database
          await database.collection("users").findOneAndUpdate(
            { _id: ObjectId(user._id) }, // Update the correct user by ID
            { $set: { sharedWithMe: user.sharedWithMe } }
          );

          request.session.status = "success";
          request.session.message = "Shared access has been removed.";

          const backURL = request.header("Referer") || "/";
          result.redirect(backURL);
          return false;
        }

        result.redirect("/Login");
      });

      // get users whom file has been shared
      app.post("/GetFileSharedWith", async function (request, result) {
        const _id = request.fields._id;

        if (request.session.user) {
          const tempUsers = await database
            .collection("users")
            .find({
              $and: [
                { "sharedWithMe.file._id": ObjectId(_id) },
                {
                  "sharedWithMe.sharedBy._id": ObjectId(
                    request.session.user._id
                  ),
                },
              ],
            })
            .toArray();

          var users = [];

          for (var a = 0; a < tempUsers.length; a++) {
            var sharedObj = null;

            for (var b = 0; b < tempUsers[a].sharedWithMe.length; b++) {
              if (tempUsers[a].sharedWithMe[b].file._id.toString() == _id) {
                sharedObj = {
                  _id: tempUsers[a].sharedWithMe[b]._id,
                  sharedAt: tempUsers[a].sharedWithMe[b].createdAt,
                };
              }
            }

            users.push({
              _id: tempUsers[a]._id,
              name: tempUsers[a].name,
              email: tempUsers[a].email,
              sharedObj: sharedObj,
            });
          }

          result.json({
            status: "success",
            message: "Record has been fetched.",
            users: users,
          });
          return false;
        }

        result.json({
          status: "error",
          message: "Please login to perform this action.",
        });
      });

      // share the file with the user
      app.post("/Share", async function (request, result) {
        const _id = request.fields._id;
        const type = request.fields.type;
        const email = request.fields.email;

        if (request.session.user) {
          var user = await database
            .collection("users")
            .findOne({ email: email });

          if (user == null) {
            request.session.status = "error";
            request.session.message = "User " + email + " does not exist.";

            result.redirect("/MyUploads");

            return false;
          }

          if (!user.isVerified) {
            request.session.status = "error";
            request.session.message =
              "User " + user.name + "account is not verified.";

            result.redirect("/MyUploads");

            return false;
          }

          var me = await database.collection("users").findOne({
            _id: ObjectId(request.session.user._id),
          });

          var file = null;

          if (type == "folder") {
            file = await recursiveGetFolder(me.uploaded, _id);
          } else {
            file = await recursiveGetFile(me.uploaded, _id);
          }

          console.log("Checking file:", file._id);

          if (file == null) {
            request.session.status = "error";
            request.session.message = "File does not exist.";

            result.redirect("/MyUploads");

            return false;
          }

          file._id = ObjectId(file._id);
          const sharedBy = me;

          await database.collection("users").findOneAndUpdate(
            {
              _id: user._id,
            },
            {
              $push: {
                sharedWithMe: {
                  _id: ObjectId(),
                  file: file,
                  sharedBy: {
                    _id: ObjectId(sharedBy._id),
                    name: sharedBy.name,
                    email: sharedBy.email,
                  },
                  createdAt: new Date().getTime(),
                },
              },
            }
          );

          request.session.status = "success";
          request.session.message =
            "File has been shared with " + user.name + ".";

          const backURL = request.header("Referer") || "/";

          result.redirect(backURL);

          return false;
        }

        result.redirect("/Login");
      });

      // get user for confirmation
      app.post("/GetUser", async function (request, result) {
        const email = request.fields.email;

        if (request.session.user) {
          var user = await database.collection("users").findOne({
            email: email,
          });

          if (user == null) {
            result.json({
              status: "error",
              message: "user " + email + " does not exists.",
            });

            return false;
          }

          if (!user.isVerified) {
            result.json({
              status: "error",
              message: "user " + user.name + " account is not verified.",
            });

            return false;
          }

          result.json({
            status: "success",
            message: "Data has been fetched.",
            user: {
              _id: user._id,
              name: user.name,
              email: user.email,
            },
          });
          return false;
        }

        result.json({
          status: "error",
          message: "Please login to perform this action.",
        });

        return false;
      });

      // Delete folder route
      // app.post("/DeleteDirectory", async function (request, result) {
      //   const _id = request.fields._id;

      //   if (request.session.user) {
      //     const user = await database.collection("users").findOne({
      //       _id: ObjectId(request.session.user._id),
      //     });

      //     const updatedArray = await removeFolderReturnUpdated(
      //       user.uploaded,
      //       _id
      //     );

      //     for (let a = 0; a < updatedArray.length; a++) {
      //       updatedArray[a]._id = ObjectId(updatedArray[a]._id);
      //     }

      //     await database.collection("users").updateOne(
      //       {
      //         _id: ObjectId(request.session.user._id),
      //       },
      //       {
      //         $set: { uploaded: updatedArray },
      //       }
      //     );

      //     const backURL = request.header("Referer") || "/";
      //     result.redirect(backURL);

      //     return false;
      //   }

      //   result.redirect("/Login");
      // });
      app.post("/DeleteDirectory", async function (request, result) {
        const _id = request.fields._id;

        if (request.session.user) {
          var user = await database.collection("users").findOne({
            _id: ObjectId(request.session.user._id),
          });

          var updatedArray = await removeFolderReturnUpdated(
            user.uploaded,
            _id
          );

          for (var a = 0; a < updatedArray.length; a++) {
            updatedArray[a]._id = ObjectId(updatedArray[a]._id);
          }

          await database.collection("users").updateOne(
            {
              _id: ObjectId(request.session.user._id),
            },
            {
              $set: { uploaded: updatedArray },
            }
          );

          // Add a confirmation message for the user
          request.status = "success";
          request.message = "Folder deleted successfully!";
          result.redirect("/MyUploads");

          return false;
        }

        result.redirect("/Login");
      });

      // Delete file route
      app.post("/DeleteFile", async function (request, result) {
        const _id = request.fields._id;

        if (request.session.user) {
          var user = await database.collection("users").findOne({
            _id: ObjectId(request.session.user._id),
          });

          var updatedArray = await removeFileReturnUpdate(user.uploaded, _id);

          for (var a = 0; a < updatedArray.length; a++) {
            updatedArray[a]._id = ObjectId(updatedArray[a]._id);
          }

          await database.collection("users").updateOne(
            {
              _id: ObjectId(request.session.user._id),
            },
            {
              $set: {
                uploaded: updatedArray,
              },
            }
          );

          const backURL = request.header("Referer") || "/";
          result.redirect(backURL);
          return false;
        }

        result.redirect("/Login");
      });

      // upload folder route
      app.post("/UploadFile", async function (request, result) {
        if (request.session.user) {
          var user = await database
            .collection("users")
            .findOne({ _id: ObjectId(request.session.user._id) });

          if (request.files.file.size > 0) {
            const _id = request.fields._id;
            var uploadedObj = {
              _id: ObjectId(),
              size: request.files.file.size, // in bytes
              name: request.files.file.name,
              type: request.files.file.type,
              filePath: "",
              createdAt: new Date().getTime(),
            };

            var filePath = "";

            // If it's the root path
            if (_id === "") {
              filePath =
                "public/uploads/" +
                user.email +
                "/" +
                new Date().getTime() +
                "-" +
                request.files.file.name;
              uploadedObj.filePath = filePath;

              if (!fileSystem.existsSync("public/uploads/" + user.email)) {
                fileSystem.mkdirSync("public/uploads/" + user.email, {
                  recursive: true,
                });
              }

              // Read the file
              fileSystem.readFile(
                request.files.file.path,
                function (err, data) {
                  if (err) throw err;
                  console.log("File read!");

                  // Write the file
                  fileSystem.writeFile(filePath, data, async function (err) {
                    if (err) throw err;
                    console.log("File written!");

                    await database
                      .collection("users")
                      .updateOne(
                        { _id: ObjectId(request.session.user._id) },
                        { $push: { uploaded: uploadedObj } }
                      );

                    result.redirect("/MyUploads/" + _id);
                  });

                  // Delete the temporary file
                  fileSystem.unlink(request.files.file.path, function (err) {
                    if (err) throw err;
                    console.log("Temporary file deleted!");
                  });
                }
              );
            } else {
              // If it's a folder
              var folderObj = await recursiveGetFolder(user.uploaded, _id);
              uploadedObj.filePath =
                folderObj.folderPath + "/" + request.files.file.name;

              var updatedArray = await getUpdatedArray(
                user.uploaded,
                _id,
                uploadedObj
              );

              // Read the file
              fileSystem.readFile(
                request.files.file.path,
                function (err, data) {
                  if (err) throw err;
                  console.log("File read!");

                  // Write the file
                  fileSystem.writeFile(
                    uploadedObj.filePath,
                    data,
                    async function (err) {
                      if (err) throw err;
                      console.log("File written!");

                      // Update the uploaded array with the new file
                      for (var a = 0; a < updatedArray.length; a++) {
                        updatedArray[a]._id = ObjectId(updatedArray[a]._id);
                      }

                      await database
                        .collection("users")
                        .updateOne(
                          { _id: ObjectId(request.session.user._id) },
                          { $set: { uploaded: updatedArray } }
                        );

                      result.redirect("/MyUploads/" + _id);
                    }
                  );

                  // Delete the temporary file
                  fileSystem.unlink(request.files.file.path, function (err) {
                    if (err) throw err;
                    console.log("Temporary file deleted!");
                  });
                }
              );
            }
          } else {
            request.status = "error";
            request.message = "Please select a valid image.";
            result.render("MyUploads", { request: request });
          }
          return false;
        }
        result.redirect("/Login");
      });

      // create folder route
      app.post("/CreateFolder", async function (request, result) {
        const name = request.fields.name;
        const _id = request.fields._id;

        if (request.session.user) {
          var user = await database.collection("users").findOne({
            _id: ObjectId(request.session.user._id),
          });

          var uploadedObj = {
            _id: ObjectId(),
            type: "folder",
            folderName: name,
            files: [],
            folderPath: "",
            createdAt: new Date().getTime(),
          };

          var folderPath = "";
          var updatedArray = [];

          if (_id == "") {
            folderPath = "public/uploads/" + user.email + "/" + name;
            uploadedObj.folderPath = folderPath;

            if (!fileSystem.existsSync("public/uploads/" + user.email)) {
              fileSystem.mkdirSync("public/uploads/" + user.email);
            }
          } else {
            var folderObj = await recursiveGetFolder(user.uploaded, _id);
            uploadedObj.folderPath = folderObj.folderPath + "/" + name;

            updatedArray = await getUpdatedArray(
              user.uploaded,
              _id,
              uploadedObj
            );
          }

          if (uploadedObj.folderPath == "") {
            request.session.status = "error";
            request.session.message = "Folder name must not be empty.";
            result.redirect("/MyUploads");
            return false;
          }

          if (fileSystem.existsSync(uploadedObj.folderPath)) {
            request.session.status = "error";
            request.session.message =
              "Folder with the same name already exists";
            result.redirect("/MyUploads");
            return false;
          }

          fileSystem.mkdirSync(uploadedObj.folderPath);

          if (_id == "") {
            await database.collection("users").updateOne(
              { _id: ObjectId(request.session.user._id) },
              {
                $push: { uploaded: uploadedObj },
              }
            );
          } else {
            for (var a = 0; a < updatedArray.length; a++) {
              updatedArray[a]._id = ObjectId(updatedArray[a]._id);
            }

            await database.collection("users").updateOne(
              { _id: ObjectId(request.session.user._id) },
              {
                $set: { uploaded: updatedArray },
              }
            );
          }

          result.redirect("/MyUploads/" + _id);
          return false;
        }

        // If not authenticated, redirect to login page
        result.redirect("/Login");
      });

      app.get("/MyUploads/:_id?", async function (request, result) {
        const _id = request.params._id;

        if (request.session.user) {
          var user = await database.collection("users").findOne({
            _id: ObjectId(request.session.user._id),
          });

          var uploaded = null;
          var folderName = "";
          var createdAt = "";

          if (typeof _id == "undefined") {
            uploaded = user.uploaded;
          } else {
            var folderObj = await recursiveGetFolder(user.uploaded, _id);

            if (folderObj == null) {
              request.status = "error";
              request.message = "Folder Not Found.";
              result.render("MyUploads", {
                request: request,
                uploaded: uploaded,
                _id: _id,
                folderName: folderName,
                createdAt: createdAt,
              });

              return false;
            }

            uploaded = folderObj.files;
            folderName = folderObj.folderName;
            createdAt = folderObj.createdAt;
          }

          if (uploaded == null) {
            request.status = "error";
            request.message = "Directory Not Found.";
            result.render("MyUploads", {
              request: request,
              uploaded: uploaded,
              _id: _id,
              folderName: folderName,
              createdAt: createdAt,
            });

            return false;
          }

          result.render("MyUploads", {
            request: request,
            uploaded: uploaded,
            _id: _id,
            folderName: folderName,
            createdAt: createdAt,
          });

          return false;
        }

        result.redirect("/Login");
      });

      // Home page
      app.get("/", function (request, result) {
        const backURL = request.header("Referer") || "/";

        result.render("index", {
          request: request,
          backURL: backURL,
        });
      });

      // Show page to do the registration
      app.get("/Register", function (request, result) {
        console.log("Request object for Register:", request);
        result.render("Register", {
          request: request,
        });
      });

      // Register the user
      app.post("/Register", async function (request, result) {
        var name = request.fields.name;
        var email = request.fields.email;
        var password = request.fields.password;
        var reset_token = "";
        var isVerified = false;
        var verification_token = new Date().getTime();

        try {
          // Check if user already exists
          var user = await database.collection("users").findOne({
            email: email,
          });

          if (user == null) {
            // Hash the password and create user
            const hashedPassword = await bcrypt.hash(password, 10);

            await database.collection("users").insertOne({
              name: name,
              email: email,
              password: hashedPassword,
              reset_token: reset_token,
              uploaded: [],
              sharedWithMe: [],
              isVerified: isVerified,
              verification_token: verification_token,
            });

            // Send the verification email
            var transporter = nodemailer.createTransport(nodemailerObject);

            var text =
              "Hello " +
              name +
              ",\n\n" +
              "Please verify your account (" +
              email +
              ") by clicking the following link:\n\n" +
              mainURL +
              "/verifyEmail/" +
              email +
              "/" +
              verification_token +
              "\n\n" +
              "Thank you for choosing us!";

            var html =
              "<html>" +
              "<body style='font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;'>" +
              "<div style='max-width: 600px; margin: 0 auto; background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);'>" +
              "<h2 style='color: #333; font-size: 24px;'>Hello " +
              name +
              ",</h2>" +
              "<p style='color: #555; font-size: 16px;'>Please verify your account (" +
              email +
              ") by clicking the following link:</p>" +
              "<br>" +
              "<p style='text-align: center;'>" +
              "<a href='" +
              mainURL +
              "/verifyEmail/" +
              email +
              "/" +
              verification_token +
              "' " +
              "style='background-color: #007bff; color: white; padding: 15px 30px; font-size: 16px; text-decoration: none; border-radius: 5px;'>" +
              "Confirm Email</a>" +
              "</p>" +
              "<br>" +
              "<p style='color: #555; font-size: 16px;'>Thank you for choosing us!</p>" +
              "<p style='color: #888; font-size: 12px;'>If you did not request this verification, please ignore this message.</p>" +
              "</div>" +
              "</body>" +
              "</html>";

            await transporter.sendMail(
              {
                from: nodemailerForm,
                to: email,
                subject: "Email Verification",
                text: text,
                html: html,
              },
              function (error, info) {
                if (error) {
                  console.error("Error sending email:", error);
                } else {
                  console.log("Email sent: " + info.response);
                }
              }
            );

            // Success response
            request.status = "success";
            request.message =
              "Signed up successfully. An email has been sent to verify your account. Once verified, you will be able to login and start using file transfer.";

            result.render("Register", {
              request: request,
            });
          } else {
            // Email already exists
            request.status = "error";
            request.message = "Email already exists.";

            result.render("Register", {
              request: request,
            });
          }
        } catch (error) {
          console.error("Error during registration:", error);

          // Error response
          request.status = "error";
          request.message = "An error occurred. Please try again.";

          result.render("Register", {
            request: request,
          });
        }
      });

      // Verify email route
      app.get(
        "/verifyEmail/:email/:verification_token",
        async function (request, result) {
          var email = request.params.email;
          var verification_token = request.params.verification_token;

          try {
            var user = await database.collection("users").findOne({
              $and: [
                { email: email },
                { verification_token: parseInt(verification_token) },
              ],
            });

            if (user == null) {
              request.status = "error";
              request.message =
                "Email does not exist or verification link is expired.";

              result.render("Login", { request: request });
            } else {
              // Update user to verified and clear verification token
              await database.collection("users").findOneAndUpdate(
                {
                  $and: [
                    { email: email },
                    { verification_token: parseInt(verification_token) },
                  ],
                },
                {
                  $set: {
                    verification_token: "", // Clear verification token
                    isVerified: true, // Set user as verified
                  },
                }
              );

              request.status = "success";
              request.message = "Account has been verified. Please try login.";

              result.render("Login", { request: request });
            }
          } catch (error) {
            console.error("Error during email verification:", error);
            request.status = "error";
            request.message = "An error occurred. Please try again.";
            result.render("Login", { request: request });
          }
        }
      );

      // Login Rout
      app.get("/Login", function (request, result) {
        result.render("Login", { request: request });
      });

      // Login Route (moved outside of verification)
      app.post("/Login", async function (request, result) {
        var email = request.fields.email;
        var password = request.fields.password;

        var user = await database.collection("users").findOne({ email: email });

        if (user == null) {
          request.status = "error";
          request.message = "Email does not exist.";
          result.render("Login", { request: request });

          return false;
        }

        bcrypt.compare(password, user.password, function (error, isVerify) {
          if (isVerify) {
            if (user.isVerified) {
              request.session.user = user;
              result.redirect("/");

              return false;
            }

            request.status = "error";
            request.message = "Kindly verify your email.";
            result.render("Login", { request: request });

            return false;
          }

          request.status = "error";
          request.message = "Password is not correct.";
          result.render("Login", { request: request });
        });
      });

      // Forgot Password Route
      app.get("/ForgotPassword", function (request, result) {
        result.render("ForgotPassword", { request: request });
      });

      // Send Recovery Link Route
      app.post("/SendRecoveryLink", async function (request, result) {
        var email = request.fields.email;
        var user = await database.collection("users").findOne({ email: email });

        if (user == null) {
          request.status = "error";
          request.message = "Email does not exist.";
          result.render("ForgotPassword", { request: request });
          return false;
        }

        var reset_token = new Date().getTime();

        await database.collection("users").findOneAndUpdate(
          { email: email },
          {
            $set: {
              reset_token: reset_token,
            },
          }
        );

        var transporter = nodemailer.createTransport(nodemailerObject);

        var text =
          "Please click the following link to reset your password: " +
          mainURL +
          "/ResetPassword/" +
          email +
          "/" +
          reset_token;

        var html =
          "Please click the following link to reset your password: <br><br> <a href='" +
          mainURL +
          "/ResetPassword/" +
          email +
          "/" +
          reset_token +
          "'>Reset Password</a> <br><br> Thank you.";

        transporter.sendMail(
          {
            from: nodemailerForm,
            to: email,
            subject: "Reset Password",
            text: text,
            html: html,
          },
          function (error, info) {
            if (error) {
              console.error(error);
            } else {
              console.log("Email sent: " + info.response);
            }

            request.status = "success";
            request.message =
              "Email has been sent with the link to recover the password.";
            result.render("ForgotPassword", { request: request });
          }
        );
      });

      // RestPassword mail Link Route
      app.get(
        "/ResetPassword/:email/:reset_token",
        async function (request, result) {
          var email = request.params.email;
          var reset_token = request.params.reset_token;

          var user = await database.collection("users").findOne({
            $and: [{ email: email }, { reset_token: parseInt(reset_token) }],
          });

          if (user == null) {
            request.status = "error";
            request.message = "Link is expired.";
            result.render("Error", { request: request });

            return false;
          }

          result.render("ResetPassword", {
            request: request,
            email: email,
            reset_token: reset_token,
          });
        }
      );

      // RestPassword Route
      app.post("/ResetPassword", async function (request, result) {
        var email = request.fields.email;
        var reset_token = request.fields.reset_token;
        var new_password = request.fields.new_password;
        var confirm_password = request.fields.confirm_password;

        // Check if the new password matches the confirm password
        if (new_password != confirm_password) {
          request.status = "error";
          request.message = "Password does not match.";
          result.render("ResetPassword", {
            request: request,
            email: email,
            reset_token: reset_token,
          });
          return false;
        }

        try {
          // Find user by email and reset_token
          var user = await database.collection("users").findOne({
            $and: [{ email: email }, { reset_token: parseInt(reset_token) }],
          });

          if (user == null) {
            request.status = "error";
            request.message =
              "Email does not exist or recovery link is expired.";
            result.render("ResetPassword", {
              request: request,
              email: email,
              reset_token: reset_token,
            });
            return false;
          }

          // Hash the new password asynchronously
          bcrypt.hash(new_password, 10, async function (error, hash) {
            // Update password and reset token in the database
            await database.collection("users").findOneAndUpdate(
              {
                $and: [
                  { email: email },
                  { reset_token: parseInt(reset_token) },
                ],
              },
              {
                $set: { reset_token: "", password: hash },
              }
            );
          });

          // Provide success message and redirect to the login page
          request.status = "success";
          request.message =
            "Password has been changed. Please try login again.";
          result.render("Login", { request: request });
        } catch (error) {
          console.error("Error during password reset:", error);
          request.status = "error";
          request.message = "An error occurred. Please try again.";
          result.render("ResetPassword", {
            request: request,
            email: email,
            reset_token: reset_token,
          });
        }
      });

      // Logout Route
      app.get("/Logout", function (request, result) {
        request.session.destroy();
        result.redirect("/");
      });
    }
  );
});
