@vite('resources/ts/laravel/sample.ts')
<nav class="navbar navbar-expand-lg navbar-light pl-5 pr-5 pt-2 pb-2">
  <a class="navbar-brand text-white ms-3" href="/">TektekTech</a>
  <div class="collapse navbar-collapse" id="Navber">
    <ul class="navbar-nav">
      <li class="nav-item ml-2 dropdown">
        <a href="#" class="nav-link dropdown-toggle text-white" id="navbarDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">コミュニティ</a>
        <div class="dropdown-menu" aria-labelledby="navbarDropdown">
          <a class="dropdown-item" href="#">ほげ</a>
          <a class="dropdown-item" href="#">ふご</a>
          <a class="dropdown-item" href="#">ほご</a>
        </div>
      </li>
    </ul>
    <ul class="navbar-nav ml-auto mr-5">
      <li class="nav-item ml-2">
        <a class="nav-link text-white" href="#">ストック一覧</a>
      </li>
      <li class="nav-item ml-2">
        <a class="nav-link text-white" id="history" href="/history">History</a>
      </li>
      <li class="nav-item ml-2">
        <a class="nav-link text-white" id="register" href="/register">ユーザ登録</a>
      </li>
    </ul>
  </div><!-- /.navbar-collapse -->
</nav>
