@vite('resources/ts/laravel/util/header.ts')

<nav class="navbar navbar-expand-lg navbar-light pl-5 pr-5 pt-2 pb-2">
  <!-- TODO: 良いロゴができたら置き換える -->
  <a class="navbar-brand text-white ms-3" href="/">てくてくてっく</a>
  <button 
    class="navbar-toggler"
    type="button"
    data-bs-toggle="collapse"
    data-bs-target="#Navber"
    aria-controls="Navber"
    aria-expanded="false"
    aria-label="Toggle navigation"
  >
    <span class="navbar-toggler-icon"></span>
  </button>
  <div class="collapse navbar-collapse" id="Navber">
    <ul class="navbar-nav ml-auto mr-5">
      <li class="nav-item ml-2">
        <a class="nav-link text-white" id="profile" href="/profile">Profile</a>
      </li>
    </ul>
    <ul class="navbar-nav ml-auto mr-5">
      <li class="nav-item ml-2">
        <a class="nav-link text-white" id="photograph" href="/photograph">Photograph</a>
      </li>
    </ul>
    <ul class="navbar-nav ml-auto mr-5">
      <li class="nav-item ml-2">
        <a class="nav-link text-white" id="games" href="/games">Games</a>
      </li>
    </ul>
  </div>
</nav>