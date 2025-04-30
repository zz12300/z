https://github.com/zz12300/banyun/tree/main/js/Github429.js

[rewrite_local]
^https:\/\/(raw|gist)\.githubusercontent\.com\/ url request-header (\r\n)Accept-Language:.+(\r\n) request-header $1Accept-Language: en-us$2
^https:\/\/github\.com\/ url request-header (\r\n)Accept-Language:.+(\r\n) request-header $1Accept-Language: en-us$2

hostname = raw.githubusercontent.com,gist.githubusercontent.com,github.com