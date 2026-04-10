const morePfp = document.querySelector("#stock-pfp-choose");
const signInForm = document.querySelector(".sign-in-form");
const socket = io();

const main = document.querySelector("main");

const allPfp = [{link: "/images/stock-pfp/uzi-pfp.png", text: "UZI", text_color: "#080741", id: 1},
                {link: "/images/stock-pfp/n-pfp.png", text: "SD-N", text_color: "#51FF00", id: 2},
                {link: "/images/stock-pfp/v-pfp.png", text: "SD-V", text_color: "#00FFF2", id: 3},
                {link: "/images/stock-pfp/cyn-pfp.png", text: "Cynessa", text_color: "#473965", id: 4},
                {link: "/images/stock-pfp/lizzie-pfp.png", text: "Lizzie", text_color: "#E695C3", id: 5},
                {link: "/images/stock-pfp/doll-pfp.png", text: "Doll", text_color: "#FF0000", id: 6},
                {link: "/images/stock-pfp/absolute-solver-pfp.png", text: "Absolute Solver", text_color: "linear-gradient(90deg, #9F43A1 0%, #FF0000 100%)", id: 7}]



function showOnPage() {
    const allPfpCanvas = document.createElement("div");
        allPfpCanvas.className = "all-pfp-canvas";
        allPfp.forEach((pfpSrc) => {
            const pfpDiv = document.createElement("div");
            pfpDiv.className = "pfp-div";
            const pfpImg = document.createElement("img");
            pfpImg.src = pfpSrc.link;
            pfpImg.className = "stock-pfp";
            pfpDiv.appendChild(pfpImg);
            const pfpText = document.createElement("h1");
            pfpText.textContent = pfpSrc.text;
            pfpText.className = "pfp-text";
            const pfpButton = document.createElement("button");
            pfpButton.textContent = "";
            pfpButton.className = "pfpButton";
            pfpButton.addEventListener("click", () => {
                morePfp.src = pfpSrc.link;
                morePfp.id = pfpSrc.id;
                allPfpCanvas.style.animation = "fadeOut 0.7s forwards";
                setTimeout(() => {
                    allPfpCanvas.style.display = "none";
                    allPfpCanvas.style.animation = "none";
                    signInForm.style.animation = "fadeIn 0.7s forwards";
                    signInForm.style.display = "flex";
                }, 700);
            });
            pfpButton.appendChild(pfpImg);
            pfpDiv.appendChild(pfpButton);
            if(pfpSrc.text === "Absolute Solver") {
                pfpText.style.background = pfpSrc.text_color;
                pfpText.style.webkitBackgroundClip = "text";
                pfpText.style.webkitTextFillColor = "transparent";
                pfpText.style.backgroundClip = "text";
                pfpText.style.textFillColor = "transparent";
            } else {
                pfpText.style.color = pfpSrc.text_color;
            }
            pfpDiv.appendChild(pfpText);
            allPfpCanvas.appendChild(pfpDiv);
           
        });
        main.appendChild(allPfpCanvas);
signInForm.style.animation = "fadeOut 0.7s forwards";
    setTimeout(() => {
        signInForm.style.display = "none";
        signInForm.style.animation = "none";
        allPfpCanvas.style.animation = "fadeIn 0.7s forwards";
    }, 700);
};

morePfp.addEventListener("click", () => {
    showOnPage();
})

const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const pfpInput = document.querySelector("#pfp-link");
async function saveUserData() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    const pfplink = morePfp.src;
    if (username && password) {
        const data = {username, password, pfplink}

        const response = await fetch("/api/register", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({username, password, pfplink})
        });

        const result = await response.json();
        if (result.success){
            localStorage.setItem("username", result.user.username);
            localStorage.setItem("pfplink", result.user.pfplink)
            alert("Account Created Successfully!");
            showGlobalChat();
        } else {
            alert("Error: " + result.message);
        }
    } else {
        alert("Please fill in all fields.");
    }
    
}

async function signInLastSavedAccount() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) {
        alert("Please fill in all fields.");
        return;
    }

    const data = {username, password}

    const response = await fetch("/api/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({username, password})
    });

    const result = await response.json();
    if (result.success){
        localStorage.setItem("username", result.user.username);
        localStorage.setItem("pfplink", result.user.pfplink)
        localStorage.setItem("role", result.user.role)
        morePfp.src = result.user.pfplink;
        alert("Signed in as: " + username);
        socket.emit("register username", localStorage.getItem("username"))
        showGlobalChat();
    } else {
        alert("Login failed: " +result.message);
    }
}

function renderMessage(data) {
  const msgDiv = document.createElement("div");
  msgDiv.className = "message";

  const msgPfp = document.createElement("img");
  msgPfp.src = data.pfplink;
  msgPfp.className = "message-pfp";
  msgDiv.appendChild(msgPfp);

  const msgUsername = document.createElement("h2");
  msgUsername.textContent = data.username;
  msgUsername.className = "message-username " + (data.role);

  const roleBadgeImg = document.createElement("img")
  roleBadgeImg.src = "/images/icons/" + data.role + ".svg"
  roleBadgeImg.className = "role-badge-img"
  
  const roleBadge = document.createElement("p");
  const roleData = data.role;
  roleBadge.textContent = roleData.toUpperCase();
  roleBadge.className = "role-badge " + data.role;
  
  const roleBadgeDiv = document.createElement("div");
  roleBadgeDiv.className = "role-badge-div " + (data.role);
  roleBadgeDiv.appendChild(roleBadgeImg);
  roleBadgeDiv.appendChild(roleBadge);
  
  const timeStamp = document.createElement("p");
  const dateObj = new Date(data.timeStamp);
  const options = {hours: "2-digit", minutes: "2-digit"}
  timeStamp.textContent = dateObj.toLocaleTimeString([], options);
  timeStamp.className = "time-stamp-text";

  const usernameAndTimeStampDiv = document.createElement("div");
  usernameAndTimeStampDiv.className = "username-time-stamp-div";
  usernameAndTimeStampDiv.appendChild(msgUsername);
  usernameAndTimeStampDiv.appendChild(roleBadgeDiv);
  usernameAndTimeStampDiv.appendChild(timeStamp);

  const msgText = document.createElement("p");
  msgText.textContent = data.message;
  msgText.className = "message-text";

  const msgTextDiv = document.createElement("div");
  msgTextDiv.className = "message-text-div";
  msgTextDiv.appendChild(usernameAndTimeStampDiv);
  msgTextDiv.appendChild(msgText);

  msgDiv.appendChild(msgTextDiv);
  document.getElementById("messages").appendChild(msgDiv);
  document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;

  console.log(data.role)
}


function showGlobalChat(data) {
    const allMessagesDiv = document.createElement("div");
    allMessagesDiv.className = "all-messages";
    allMessagesDiv.id = "messages";
    allMessagesDiv.scrollTop = allMessagesDiv.scrollHeight;
    
    const savedAccountDiv = document.createElement("div");
    savedAccountDiv.className = "account-info";
    const savedUsername = document.createElement("h1");
    savedUsername.textContent = localStorage.getItem("username");
    savedUsername.className = "account-username";
    const savedRole = document.createElement("p");
    savedRole.textContent = "Role: " + localStorage.getItem("role");
    savedRole.id = "role-text";
    const savedAccountTextDiv = document.createElement("div");
    savedAccountTextDiv.className = "saved-account-text-div"
    savedAccountTextDiv.appendChild(savedUsername);
    savedAccountTextDiv.appendChild(savedRole);
    savedAccountDiv.appendChild(savedAccountTextDiv);
    const savedPfp = document.createElement("img");    
    savedPfp.className = "account-pfp";
    savedPfp.src = localStorage.getItem("pfplink");
    savedAccountDiv.appendChild(savedPfp);
    
    const globalChatDiv = document.createElement("div");
    globalChatDiv.className = "global-chat";
    globalChatDiv.appendChild(allMessagesDiv);

    const rulesAndSystemInfoDiv = document.createElement("div");
    rulesAndSystemInfoDiv.className = "rules-system-info-div";
    const rulesTitle = document.createElement("h1");
    rulesTitle.textContent = "Rules And Info ";
    rulesTitle.className = "rules-title";
    rulesAndSystemInfoDiv.addEventListener("click", () => {
        ruleAndInfoList.style.display = ruleAndInfoList.style.display === "none" ? "block" : "none";
    });
    const ruleAndInfoList = document.createElement("ul");
    const rulesAndInfo = ["Be respectful to others", "No spamming or flooding the chat", "No hate speech or offensive language", "No sharing of personal information", "Follow the moderators' instructions", "Have fun and enjoy chatting!", "Chat history resets every 24 hours at midnight UTC"];
    ruleAndInfoList.className = "rules-info-list";
    ruleAndInfoList.style.listStyleType = "numbers";
    ruleAndInfoList.style.display = "none";
    rulesAndInfo.forEach((rule) => {
        const ruleItem = document.createElement("li");
        ruleItem.textContent = rule;
        ruleAndInfoList.appendChild(ruleItem);
    });
    rulesAndSystemInfoDiv.appendChild(rulesTitle);
    rulesAndSystemInfoDiv.appendChild(ruleAndInfoList);

    const messageInput = document.createElement("input");
    messageInput.type = "text";
    messageInput.placeholder = "Type here";
    messageInput.className = "info-input";
    messageInput.id = "messageInput";
    messageInput.maxlength= 500;
    
    const sendButton = document.createElement("button");
    const sendIcon = document.createElement("img");
    sendIcon.src = "images/Vector.png";
    sendIcon.className = "send-icon";
    sendButton.appendChild(sendIcon);
    sendButton.className = "send-message-button";
    sendButton.addEventListener("click",  () => sendMessage(messageInput));

    const uiDiv = document.createElement("div");
    uiDiv.appendChild(messageInput);
    uiDiv.appendChild(sendButton);
    uiDiv.className = "chat-ui";
    globalChatDiv.appendChild(uiDiv);

    

    main.appendChild(savedAccountDiv);
    main.appendChild(rulesAndSystemInfoDiv);
    main.appendChild(globalChatDiv);
    signInForm.style.animation = "fadeOut 0.7s forwards";
    setTimeout(() => {
        signInForm.style.display = "none";
        signInForm.style.animation = "none";
        globalChatDiv.style.animation = "fadeIn 0.7s forwards";
    }, 700);

    
    socket.on("chat message", (data) => {
        console.log("Incoming from server:", data);

        renderMessage(data);
    });
    
    socket.on("chat history", (history) => {
    history.forEach((data) => {
        renderMessage(data);
    });
    
    socket.on("system message", (data) => {
        const msgDiv = document.createElement("div");
        msgDiv.className = "system-message";
        msgDiv.textContent = data.text;
        msgDiv.scrollTop = msgDiv.scrollHeight;
        document.getElementById("messages").appendChild(msgDiv);
    });

    socket.on("clear chat", () =>{ 
        const messageDiv = document.getElementById("messages")
        if (messageDiv) {
            messageDiv.innerHTML = "";
        }
    });
    
    socket.on("kicked user", () =>{
        alert("You have been kicked!")
    })

    socket.on("muted", () =>{
        const sendButton = document.querySelector(".send-message-button");
        const input = document.getElementById("messageInput");
        sendButton.style.display = "none";
        input.style.display = "none";
    })

    socket.on("unmuted", () =>{
        const sendButton = document.querySelector(".send-message-button");
        const input = document.getElementById("messageInput");
        sendButton.style.display = "flex";
        input.style.display = "flex";
    })

    socket.on("changed role", (data) =>{
        const roleText = document.getElementById("role-text")
        roleText.textContent = "Role: " + data.value;
    })
});
socket.emit("request history");
};




function sendMessage(inputElement) {
  const message = inputElement.value.trim();
  if (!message) return;

    if (message.startsWith("/")) {
        const parts = message.split(" ");
        const command = parts[0].substring(1);
        let target = null;
        let value = null;

        if (command === "setrole") {
            target = parts.slice(1, -1).join(" ").trim();
            value = parts[parts.length - 1];
        } else {
            target = parts.slice(1).join(" ").trim() || null;
        }
        
        socket.emit("command", {
            username: localStorage.getItem("username"),
            command,
            target,
            value
        });
    } else {
        socket.emit("chat message", {
            username: localStorage.getItem("username"),
            pfplink: localStorage.getItem("pfplink"),
            role: localStorage.getItem("role"),
            message,
            timeStamp: new Date().toISOString()
        })
    };
    inputElement.value = "";
}
    


document.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        sendMessage(document.getElementById("messageInput"));
    }
});
