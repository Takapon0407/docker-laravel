<nav class="navbar navbar-expand-lg pt-2 pb-2">
  {{-- TODO: 良いロゴができたら置き換える --}}
  <a class="navbar-brand text-white ms-3" href="{{ route('profile') }}">てくてくテック</a>
  <button
    class="navbar-toggler"
    type="button"
    data-bs-toggle="collapse"
    data-bs-target="#navbar"
    aria-controls="navbar"
    aria-expanded="false"
    aria-label="メニューを開閉する"
  >
    <span class="navbar-toggler-icon"></span>
  </button>
  <div class="collapse navbar-collapse" id="navbar">
    <ul class="navbar-nav">
      <li class="nav-item">
        <a class="nav-link text-white" href="{{ route('profile') }}">Profile</a>
      </li>
    </ul>
    <ul class="navbar-nav">
      <li class="nav-item">
        <a class="nav-link text-white" href="{{ route('hobbies') }}">Hobbies</a>
      </li>
    </ul>
  </div>
</nav>
