import IArchiver from "../interfaces/archiver"
import IDomainList, { ListType } from "../interfaces/domainList"
import IConfig, { GlobalConfigKey } from "../interfaces/config"

export const enum ConfigKey {
  ArchiveBoxUrl = "archiveBoxUrl",
  ArchiveBoxKey = "archiveBoxKey"
}

export default class ArchiveBoxArchiver implements IArchiver {
  private domainList: IDomainList
  private config: IConfig

  private urlQueue: string[] = [ ]

  constructor(domainList: IDomainList, config: IConfig) {
    this.domainList = domainList
    this.config = config
  }
  
  async shouldArchive(url: string): Promise<boolean> {
    const mode = await this.config.get(GlobalConfigKey.ArchiveMode, "allowlist")

    if (mode === "allowlist")
      return await this.domainList.urlMatchesList(url, ListType.Allowlist)
    else if (mode === "blocklist")
      return !(await this.domainList.urlMatchesList(url, ListType.Blocklist))
  }

  async queueForArchival(url: string): Promise<void> {
    if (this.urlQueue.indexOf(url) !== -1) return
    this.urlQueue.push(url)
  }

  async submitQueue(): Promise<void> {
    this.sendUrls(this.urlQueue)
    this.urlQueue = [ ]
  }

  async archiveImmediately(url: string): Promise<void> {
    await this.sendUrls([ url ])
  }

  private requestPermissionsForHost(host: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      chrome.permissions.request({
        origins: [ `${host}/*` ]
      }, granted => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError)
        resolve(granted)
      })
    })
  }

  private async sendUrls(urls: string[]): Promise<boolean> {
    const baseUrl = await this.config.get(GlobalConfigKey.ArchiveBoxBaseUrl, "")
    const apiKey = await this.config.get(GlobalConfigKey.ArchiveBoxApiKey, "")

    const granted = await this.requestPermissionsForHost(baseUrl)
    if (!granted) return false

    const body = new FormData()
    body.append("urls", urls.join("\n"))
    body.append("tag", "browser")
    body.append("depth", "0")

    const result = await fetch(`${baseUrl}/api/add/`, {
      method: "post",
      body,
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    })

    const json = await result.json()
    return json.ok
  }
}