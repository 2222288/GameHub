package com.gamehub.auth;
import io.jsonwebtoken.*;import io.jsonwebtoken.security.Keys;import org.springframework.beans.factory.annotation.Value;import org.springframework.stereotype.Service;import javax.crypto.SecretKey;import java.nio.charset.StandardCharsets;import java.time.Instant;import java.util.Date;
@Service public class JwtService { private final SecretKey key; private final long expiration;
 public JwtService(@Value("${gamehub.jwt.secret}") String secret,@Value("${gamehub.jwt.expiration-seconds}") long expiration){ if(secret.length()<32) throw new IllegalArgumentException("JWT_SECRET must be at least 32 characters"); this.key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));this.expiration=expiration;}
 public String generate(String username){Instant now=Instant.now();return Jwts.builder().subject(username).claim("role","ROLE_ADMIN").issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(expiration))).signWith(key).compact();}
 public String subject(String token){return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload().getSubject();}
 public long getExpiration(){return expiration;}
}
