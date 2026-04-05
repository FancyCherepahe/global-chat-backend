const morePfp = document.querySelector("#stock-pfp-choose");
const signInForm = document.querySelector(".sign-in-form");
const socket = io();

const main = document.querySelector("main");

const allPfp = [{link: "images/stock-pfp/uzi-pfp.png", text: "UZI", text_color: "#080741", id: 1},
                {link: "images/stock-pfp/n-pfp.png", text: "SD-N", text_color: "#51FF00", id: 2},
                {link: "images/stock-pfp/v-pfp.png", text: "SD-V", text_color: "#00FFF2", id: 3},
                {link: "images/stock-pfp/cyn-pfp.png", text: "Cynessa", text_color: "#473965", id: 4},
                {link: "images/stock-pfp/lizzie-pfp.png", text: "Lizzie", text_color: "#E695C3", id: 5},
                {link: "images/stock-pfp/doll-pfp.png", text: "Doll", text_color: "#FF0000", id: 6},
                {link: "images/stock-pfp/absolute-solver-pfp.png", text: "Absolute Solver", text_color: "linear-gradient(90deg, #9F43A1 0%, #FF0000 100%)", id: 7}]



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
function saveUserData() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const pfpLink = morePfp.src;
    if (username && password) {
        localStorage.setItem("username", username);
        localStorage.setItem("password", password);
        localStorage.setItem("pfpLink", pfpLink);
        alert("Account created successfully!");
        showGlobalChat();
    } else {
        alert("Please fill in all fields.");
    }
    
}

function signInLastSavedAccount() {
    const savedUsername = localStorage.getItem("username");
    const savedPassword = localStorage.getItem("password");
    const savedPfpLink = localStorage.getItem("pfpLink");
    if (savedUsername && savedPassword) {
        usernameInput.value = savedUsername;
        passwordInput.value = savedPassword;
        morePfp.src = savedPfpLink;
        morePfp.id = localStorage.getItem("pfpId");
        alert("Signed in as: " + savedUsername);
        showGlobalChat();
    } else {
        alert("No saved username or password found.");
        
    }
}

function renderMessage(data) {
    const msgDiv = document.createElement("div");
            
            const savedUsername = localStorage.getItem("username");
                const msgUsername = document.createElement("h2");
            msgUsername.textContent = data.username;
            msgUsername.className = "message-username";
            
            const savedPfpLink = localStorage.getItem("pfpLink");
                const msgPfp = document.createElement("img");
            msgPfp.src = data.pfpLink;
            msgPfp.className = "message-pfp";
            msgDiv.appendChild(msgPfp);
                const msgText = document.createElement("p");
                msgText.textContent = data.message;
            msgText.className = "message-text";
            const msgTextDiv = document.createElement("div");
            msgTextDiv.className = "message-text-div";
            msgTextDiv.appendChild(msgUsername);
            msgTextDiv.appendChild(msgText);
            msgDiv.appendChild(msgTextDiv);
            
        
            
            msgDiv.className = "message";

            document.getElementById("messages").appendChild(msgDiv);
}


function showGlobalChat() {
    const allMessagesDiv = document.createElement("div");
    allMessagesDiv.className = "all-messages";
    allMessagesDiv.id = "messages";
    
    const savedAccountDiv = document.createElement("div");
    savedAccountDiv.className = "account-info";
    const savedUsername = document.createElement("h1");
    savedUsername.textContent = localStorage.getItem("username");
    savedUsername.className = "account-username";
    savedAccountDiv.appendChild(savedUsername);
    const savedPfp = document.createElement("img");    
    savedPfp.className = "account-pfp";
    savedPfp.src = localStorage.getItem("pfpLink");
    savedAccountDiv.appendChild(savedPfp);
    const globalChatDiv = document.createElement("div");
    globalChatDiv.className = "global-chat";
    globalChatDiv.appendChild(allMessagesDiv);

    const rulesAndSystemInfoDiv = document.createElement("div");
    rulesAndSystemInfoDiv.className = "rules-system-info-div";
    const rulesTitle = document.createElement("h1");
    rulesTitle.textContent = "Rules And Info ";
    rulesTitle.className = "rules-title";
    rulesTitle.addEventListener("click", () => {
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
  document.getElementById("messages").appendChild(msgDiv);
});
});
socket.emit("request history");
};




function sendMessage(inputElement) {
  const message = inputElement.value.trim();
  if (message) {
    socket.emit("chat message", {
        username: localStorage.getItem("username"),
        pfpLink: localStorage.getItem("pfpLink"),
        message
    }); 
    inputElement.value = "";
  }
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        sendMessage(document.getElementById("messageInput"));
    }
});




