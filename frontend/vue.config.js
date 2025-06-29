// vue.config.js
module.exports = {
    // 部署应用包时的基本 URL
    // 假设你要将项目部署在 mer.dev/arknights-wordle 下
    // 则这里应设置为 '/arknights-wordle/'
    publicPath: '/arknights-wordle/',
    
    // 多页面应用配置
    pages: {
      // 主页面（原有页面）
      index: {
        entry: 'src/main.js',
        template: 'public/index.html',
        filename: 'index.html',
        title: '猜！干！员！'
      },
      // 移动端小头模式页面
      bw: {
        entry: 'src/bw.js',
        template: 'public/bw.html',
        filename: 'bw/index.html',
        title: '森拉鉴定大师课毕业考试'
      }
    }
  }
  