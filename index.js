import 'dotenv/config'
import TrelloNodeAPI from 'trello-node-api';
import axios from "axios";
import fetch from 'node-fetch';
import fs from "fs"
import { convertArrayToCSV } from "convert-array-to-csv"
import moment from "moment"
import { format } from 'path';
// import { report } from 'process';

const MY_PERCENT = 1.3

let memebersScale = {
  s5_amadeus: 900 * MY_PERCENT,
  emfwws: 300 * MY_PERCENT,
  illiapiliugin: 780 * MY_PERCENT,
  progerwolf: 700 * MY_PERCENT,
  valiamat: 500 * MY_PERCENT,
  user85906472: 400 * MY_PERCENT,
  gmoll: 1000 * MY_PERCENT,
  rawil_gizzatullin: 1000,
  user28798223: 1000 * MY_PERCENT,
  nasim: 700 * MY_PERCENT,
  sipehr: 1000 * MY_PERCENT,
  unknow1: 500 * MY_PERCENT,
  unknow2: 500 * MY_PERCENT,
  imiroff: 700 * MY_PERCENT,
  skripnikov: 700 * MY_PERCENT,
  ura141: 720 * MY_PERCENT,
  p1nkx1: 500 * MY_PERCENT,
  valentin: 500 * MY_PERCENT,
  theos18: 650 * MY_PERCENT,
  arhangel7b: 1000 * MY_PERCENT
}

let deletedMembers = [
  {
    username: "nasim",
    id: "5ca1af2abb96493e36cf1e50"
  },
  {
    username: "sipehr",
    id: "62c4777da3c769869a1722a5"
  },
  {
    username: "skripnikov",
    id: "5e57c1147054647bcddb50e9"
  },
  {
    username: "unknow1",
    id: "52653b786bbffe2806004ee1" 
  },
  {
    username: "unknow2",
    id: "5f1ac0babb5f4d1ed7779f76"
  },
  {
    username: "imiroff",
    id: "52653b786bbffe2806004ee1"
  },
  {
    username: "ura141",
    id: "63774dbf59b5df007048d75a"
  },
  {
    username: "p1nkx1",
    id: "62c2b25beaaf4156a550cfaa"
  },
  {
    id: "605cb1652b0b841b0c8929d5",
    username: "valentin"
  },
  {
    id: "59738feee636df6f293eafb1",
    username: "theos18"
  },
  {
    id: "5eeb534a940ef242f2efae1d",
    username: "arhangel7b"
  },
  {
    id: "5ccab6f8e578c342a400a491",
    username: "s5_amadeus"
  }
]

class Report {
  constructor({ apiKey, oauthToken, boardId, compliteListId }) {
    this.isTest = 0
    this._apiKey = apiKey
    this._oauthToken = oauthToken
    this._boardId = boardId
    this._compliteListId = compliteListId

    this._Trello = new TrelloNodeAPI()
    this._Trello.setApiKey(apiKey)
    this._Trello.setOauthToken(oauthToken);

    this.compliteCards = []
    this.memebersScale = {}
  }
  async report() {
    await this._setMembersScale()
    await this._setCardsFromCompliteList()
    let workLogs = await this._getWorkLogsFromBoardList();
    let resultCards = workLogs.map(log => (
      this._getResultCardFromWorkLog(log)
    ))
    return resultCards
  }
  async _setMembersScale() {
    let allMembers = await this._Trello.board
      .searchMembers(this._boardId)
    allMembers = [
      ...allMembers,
      ...deletedMembers
    ]
    allMembers.forEach(member => {
      Object.keys(memebersScale).forEach((username, i) => {
        if (username === member.username)
          this.memebersScale[member.id] = memebersScale[username]
      })
    })
  }
  async _setCardsFromCompliteList() {
    let response;
    try {
      response = await this._Trello.board
        .searchCards(this._boardId)
        .filter(card => card.idList === this._compliteListId)
    } catch (error) {
      if (error) {
        console.log('error ', error);
      }
    }
    this.compliteCards = response.map(card => ({
      id: card.id,
      link: card.shortUrl,
      name: card.name,
      dateLastActivity: card.dateLastActivity,
      category: card.labels.sort((a, b) => (
        a.name > b.name
      )).reduce((acc, card) => (
        acc + ", " + card.name
      ), "")
        .slice(2)
    }))
    return this.compliteCards.sort((a, b) => {
      return +new Date(a.dateLastActivity) - +new Date(b.dateLastActivity)
    })
  }
  _getResultCardFromWorkLog(workLog) {
    let sum = 0
    let seconds = 0
    let owners = ""
    for (const employee in workLog.userSeconds) {
      if (!this.memebersScale[employee]) console.log("not found employee", employee)
      sum += workLog.userSeconds[employee] * this.memebersScale[employee] / 3600
      seconds += workLog.userSeconds[employee]
      owners += employee + ","
    }
    let rate = Math.floor(sum * 3600 / seconds)
    if (sum === NaN || sum === 'NaN') sum = 0
    if (!seconds) rate = 0
    let result = {
      sum,
      rate,
      seconds,
      owners,
      ...workLog
    }
    return result
  }
  async _getWorkLogsFromBoardList() {
    let delay = this.isTest ? 1 : 500
    let end = this.isTest ? 10 : 1000000
    let worklogPromises = this.compliteCards.slice(0, end)
      .map(async (card, i) => {
        return new Promise(resolve => {
          setTimeout(async () => {
            const workLog = await this.getWorkLogCardByid(card.id, card)
            console.log(
              Math.floor(i / Math.min(end, this.compliteCards.length) * 100) + "%"
            )
            resolve({
              userSeconds: workLog.userSeconds,
              totalWorklogs: workLog.totalWorklogs,
              ...card
            })
          }, i * delay)
        }) 
        
      })
    return (await Promise.all(worklogPromises))
      
  }
  async getWorkLogCardByid(cardId, card) {
    if (!cardId) throw new Error('has no cardId')
    return fetch("https://chronos-api-proxy.web-pal.com/api/trello/getWorklogsMeta", {
      "headers": {
        "accept": "application/json",
        "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,tg;q=0.6",
        "authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwNTc4NWY1ZjQxYjFkNjIyMWIxZjJjYiIsImlkUGx1Z2luIjoiNWQyZGRlZDk3YmRkZWQwZmRiNjYzOGY4IiwiaWRCb2FyZCI6IjYyOTM0NTkyNWYyYTcyM2Y1NDE0ZTViOSIsImlkTWVtYmVyIjoiNjA1Nzg1ZjVmNDFiMWQ2MjIxYjFmMmNiIiwiaWRPcmdhbml6YXRpb24iOiI2MDhkMjRjZGM1NDI1Mjg5OGNmMjA1YjEiLCJpc0FkbWluIjp0cnVlLCJpYXQiOjE2NjI4MjcyMjUsImV4cCI6MTY5NDM2MzIyNX0.K_8W3pwmiRd_OM1ynOjjtEGKosw17ZlIFgJZX4gvU5E",
        "cache-control": "no-cache",
        "content-type": "application/json",
        "pragma": "no-cache",
        "sec-ch-ua": "\"Google Chrome\";v=\"105\", \"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"105\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site"
      },
      "referrer": "https://chronos-trello-app.web-pal.com/",
      "referrerPolicy": "strict-origin-when-cross-origin",
      "body": `{\"cardIds\":["${cardId}"],\"timezoneOffset\":-180}`,
      "method": "POST",
      "mode": "cors",
      "credentials": "include"
    }).then(r => {
      return r.json()
    })
  }
}


class CSVReport {
  constructor(resultCards) {
    this.resultCards = resultCards
    this.labels = [
      'Название', 
      'Потраченное время', 
      'Стоимость часа',
      'Ссылка на карточку',
      'Категории',
      'Итого',
      'Итого за период'
    ]
  }
  generateCSV(filepath = `reports/${new Date()}.csv`) {
    let data = this._getCSVLabels()
    let resultCardArrays = this.resultCards.map(card => [
      card.name,
      this._formatSeconds(card.seconds),
      card.rate,
      card.link,
      card.category,
      Math.floor(card.sum),
    ])
    resultCardArrays
      .sort((a, b) => a.category > b.category)
      .forEach(cardArray => {
        data += this._getCSVStringFromArray(cardArray)
      })
    const resultSum = this.resultCards.reduce((acc, card) => acc += card.sum, 0)

    const resultSumRow = Array(this.labels.length - 1).fill("")
    resultSumRow.push(Math.floor(resultSum))
    data += this._getCSVStringFromArray(resultSumRow)

    this._writeCSVTofile(filepath, data)
  }
  _writeCSVTofile(filename, data) {
    fs.writeFile(filename, data, (err) => {
      if (err) throw err
      console.log('report generated')
    })
  }
  _formatSeconds(seconds) {
    let h = Math.floor(seconds / 3600)
    let m = Math.floor((seconds - h * 3600) / 60)
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }
  _getCSVLabels() {
    return this._getCSVStringFromArray(this.labels)
  }
  _getCSVStringFromArray(arr) {
    return arr.reduce((acc, l) => acc + l + "|", "") + "\n"
  }
  _formatDate(dateString) {
    const date = new Date(dateString)
    const padTo2Digits = (num) => {
      return num.toString().padStart(2, '0');
    }
    return [
      padTo2Digits(date.getDate()),
      padTo2Digits(date.getMonth() + 1),
      String(date.getFullYear()).slice(2),
    ].join(".")
  }
}

(async () => {
  const report = new Report({
    apiKey: process.env.API_KEY,
    oauthToken: process.env.OAUTH_TOKEN,
    boardId: process.env.BOARD_ID,
    compliteListId: process.env.COMPLITE_LIST_ID
  })
  
  const resultCards = await report.report()
  
  const csvReport = new CSVReport(resultCards)
  csvReport.generateCSV()
})()