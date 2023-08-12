@vite('resources/ts/laravel/sample.ts')
@vite('resources/sass/app.scss')
<nav class="navbar navbar-expand-lg navbar-light pl-5 pr-5 pt-2 pb-2">
  <a class="navbar-brand text-white ms-3" href="/">TektekTech</a>
  <div class="collapse navbar-collapse" id="Navber">
    <ul class="navbar-nav">
      <li class="nav-item ml-2 dropdown">
      <div class="dropdown">
        <button class="btn btn-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
          Dropdown
        </button>
        <ul class="dropdown-menu">
          <li><button class="dropdown-item" type="button">Dropdown item 1</button></li>
          <li><button class="dropdown-item" type="button">Dropdown item 2</button></li>
          <li><button class="dropdown-item" type="button">Dropdown item 3</button></li>
        </ul>
      </div>
      </li>
    </ul>
    <ul class="navbar-nav ml-auto mr-5">
      <li class="nav-item ml-2">
        <a class="nav-link text-white" id="history" href="/history">History</a>
      </li>
    </ul>
  </div>
</nav>