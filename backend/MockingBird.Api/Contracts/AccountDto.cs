namespace MockingBird.Contracts;

public record AccountDto(bool Authenticated, string DisplayName = "", string Email = "", bool IsAdmin = false, string Status = "");
